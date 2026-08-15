import { uid } from '../utils/id.js';

const DEFAULT_LIMITS = Object.freeze({
    maxRequestBytes: 256 * 1024,
    maxResponseBytes: 256 * 1024,
    maxDepth: 16,
    maxNodes: 10_000,
    maxKeys: 1_000,
    maxArrayLength: 10_000,
    maxStringBytes: 128 * 1024,
    timeoutMs: 15_000
});

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const encoder = new TextEncoder();

export class WorkerBrokerError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'WorkerBrokerError';
        this.code = code;
    }
}

function fail(code, message) {
    throw new WorkerBrokerError(code, message);
}

function byteLength(value) {
    return encoder.encode(value).byteLength;
}

function isTransferableValue(value, transferSet) {
    if (!transferSet.has(value)) return false;
    if (value instanceof ArrayBuffer) return true;
    if (ArrayBuffer.isView(value)) return transferSet.has(value.buffer);
    return typeof MessagePort !== 'undefined' && value instanceof MessagePort;
}

/**
 * Rejects non-plain/cyclic/prototype-polluting data and enforces structural limits.
 * Transferable leaves are accepted only when explicitly present in `transfer`.
 */
export function validateBoundedPlainData(value, limits = {}, transfer = []) {
    const resolved = { ...DEFAULT_LIMITS, ...limits };
    const transferSet = new Set(transfer);
    const seen = new WeakSet();
    let bytes = 0;
    let nodes = 0;
    let keys = 0;

    const addBytes = (count) => {
        bytes += count;
        if (bytes > resolved.maxBytes) fail('PAYLOAD_TOO_LARGE', 'Payload exceeds the configured byte limit');
    };

    const visit = (entry, depth) => {
        nodes += 1;
        if (nodes > resolved.maxNodes) fail('PAYLOAD_TOO_COMPLEX', 'Payload exceeds the configured node limit');
        if (depth > resolved.maxDepth) fail('PAYLOAD_TOO_DEEP', 'Payload exceeds the configured depth limit');

        if (entry === null) {
            addBytes(4);
            return;
        }

        switch (typeof entry) {
            case 'string': {
                const length = byteLength(entry);
                if (length > resolved.maxStringBytes) fail('PAYLOAD_TOO_LARGE', 'Payload string exceeds the configured byte limit');
                addBytes(length + 2);
                return;
            }
            case 'boolean':
                addBytes(entry ? 4 : 5);
                return;
            case 'number':
                if (!Number.isFinite(entry)) fail('INVALID_PAYLOAD', 'Payload numbers must be finite');
                addBytes(String(entry).length);
                return;
            case 'object':
                break;
            default:
                fail('INVALID_PAYLOAD', 'Payload contains an unsupported value');
        }

        if (isTransferableValue(entry, transferSet)) {
            if (entry instanceof ArrayBuffer || ArrayBuffer.isView(entry)) addBytes(entry.byteLength);
            else addBytes(1);
            return;
        }
        if (seen.has(entry)) fail('INVALID_PAYLOAD', 'Payload must not contain cycles or aliases');
        seen.add(entry);

        if (Array.isArray(entry)) {
            if (entry.length > resolved.maxArrayLength) fail('PAYLOAD_TOO_COMPLEX', 'Payload array exceeds the configured length limit');
            addBytes(2 + Math.max(0, entry.length - 1));
            for (const item of entry) visit(item, depth + 1);
            return;
        }

        const prototype = Object.getPrototypeOf(entry);
        if (prototype !== Object.prototype && prototype !== null) fail('INVALID_PAYLOAD', 'Payload objects must be plain objects');
        const ownKeys = Reflect.ownKeys(entry);
        if (ownKeys.some(key => typeof key !== 'string')) fail('INVALID_PAYLOAD', 'Payload symbol keys are forbidden');
        keys += ownKeys.length;
        if (keys > resolved.maxKeys) fail('PAYLOAD_TOO_COMPLEX', 'Payload exceeds the configured key limit');
        addBytes(2 + Math.max(0, ownKeys.length - 1));
        for (const key of ownKeys) {
            if (FORBIDDEN_KEYS.has(key)) fail('FORBIDDEN_PAYLOAD_KEY', 'Payload contains a forbidden key');
            const descriptor = Object.getOwnPropertyDescriptor(entry, key);
            if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('INVALID_PAYLOAD', 'Payload accessors are forbidden');
            const keyLength = byteLength(key);
            if (keyLength > resolved.maxStringBytes) fail('PAYLOAD_TOO_LARGE', 'Payload key exceeds the configured byte limit');
            addBytes(keyLength + 3);
            visit(descriptor.value, depth + 1);
        }
    };

    if (!Number.isFinite(resolved.maxBytes) || resolved.maxBytes < 1) fail('INVALID_LIMITS', 'A positive maxBytes limit is required');
    visit(value, 0);
    return bytes;
}

function requireIdentifier(value, field) {
    if (typeof value !== 'string' || !SAFE_IDENTIFIER.test(value)) fail('INVALID_REQUEST', `${field} must be a bounded safe identifier`);
}

function createRequestId() {
    return uid('worker-request');
}

function resolveWorkerDescriptor(entry, allowedUrls) {
    const resolved = typeof entry === 'function' ? entry() : entry;
    const descriptor = typeof resolved === 'string' || resolved instanceof URL ? { url: resolved } : resolved;
    if (!descriptor || typeof descriptor !== 'object' || !('url' in descriptor)) fail('WORKER_NOT_ALLOWED', 'Worker factory returned an invalid descriptor');
    const url = String(descriptor.url);
    if (!url || (allowedUrls && !allowedUrls.has(url))) fail('WORKER_NOT_ALLOWED', 'Worker URL is not allowlisted');
    const options = descriptor.options ?? {};
    if (Object.getPrototypeOf(options) !== Object.prototype) fail('WORKER_NOT_ALLOWED', 'Worker options must be a plain object');
    return { url: descriptor.url, options };
}

function sanitizedWorkerError() {
    return new WorkerBrokerError('WORKER_ERROR', 'Worker request failed');
}

export class WorkerBroker {
    constructor({ threadManager, workers, allowedUrls, capabilityValidator, getRevision, limits = {} }) {
        if (!threadManager || typeof threadManager.spawn !== 'function' || typeof threadManager.subscribe !== 'function' || typeof threadManager.postMessage !== 'function' || typeof threadManager.terminate !== 'function') {
            throw new TypeError('WorkerBroker requires a ThreadManager-compatible instance');
        }
        if (!(workers instanceof Map) && (workers === null || typeof workers !== 'object')) throw new TypeError('WorkerBroker requires an allowlisted worker map');
        if (typeof capabilityValidator !== 'function') throw new TypeError('WorkerBroker requires a capability validation hook');
        if (typeof getRevision !== 'function') throw new TypeError('WorkerBroker requires a revision provider');
        this.threadManager = threadManager;
        this.workers = workers instanceof Map ? new Map(workers) : new Map(Object.entries(workers));
        this.allowedUrls = allowedUrls ? new Set(Array.from(allowedUrls, String)) : null;
        this.capabilityValidator = capabilityValidator;
        this.getRevision = getRevision;
        this.limits = { ...DEFAULT_LIMITS, ...limits };
        this.pending = new Map();
        this.workerStates = new Map();
        this.closed = false;
    }

    get pendingCount() {
        return this.pending.size;
    }

    async request(workerId, request, { signal, transfer = [], timeoutMs = this.limits.timeoutMs, onAccepted } = {}) {
        if (this.closed) fail('BROKER_CLOSED', 'Worker broker is closed');
        requireIdentifier(workerId, 'workerId');
        if (!this.workers.has(workerId)) fail('WORKER_NOT_ALLOWED', 'Worker is not allowlisted');
        if (!request || Object.getPrototypeOf(request) !== Object.prototype) fail('INVALID_REQUEST', 'Worker request must be a plain object');
        requireIdentifier(request.documentId, 'documentId');
        requireIdentifier(request.intent, 'intent');
        if (!Number.isSafeInteger(request.baseRevision) || request.baseRevision < 0) fail('INVALID_REQUEST', 'baseRevision must be a non-negative safe integer');
        if (!Array.isArray(transfer)) fail('INVALID_REQUEST', 'transfer must be an array');
        if (signal !== undefined && !(signal instanceof AbortSignal)) fail('INVALID_REQUEST', 'signal must be an AbortSignal');
        if (onAccepted !== undefined && typeof onAccepted !== 'function') fail('INVALID_REQUEST', 'onAccepted must be a function');
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > this.limits.timeoutMs) fail('INVALID_REQUEST', 'timeoutMs is outside the configured limit');
        if (signal?.aborted) fail('ABORTED', 'Worker request was aborted');

        try {
            await this.capabilityValidator(request);
        } catch (error) {
            if (error?.code === 'STALE_REVISION' || error?.code === 'stale-revision') fail('STALE_REVISION', 'Worker request base revision is stale');
            fail('UNAUTHORIZED', 'Worker request is not authorized');
        }
        if (signal?.aborted) fail('ABORTED', 'Worker request was aborted');
        const revisionBeforeSend = this.getRevision(request.documentId);
        if (revisionBeforeSend !== request.baseRevision) fail('STALE_REVISION', 'Worker request base revision is stale');

        validateBoundedPlainData(request.payload, { ...this.limits, maxBytes: this.limits.maxRequestBytes }, transfer);
        const requestId = createRequestId();
        const message = {
            type: 'WORKER_REQUEST',
            requestId,
            documentId: request.documentId,
            baseRevision: request.baseRevision,
            intent: request.intent,
            payload: request.payload
        };
        validateBoundedPlainData(message, { ...this.limits, maxBytes: this.limits.maxRequestBytes }, transfer);
        this.#ensureWorker(workerId);

        return new Promise((resolve, reject) => {
            const finish = (error, payload) => {
                const pending = this.pending.get(requestId);
                if (!pending) return;
                this.pending.delete(requestId);
                clearTimeout(pending.timeout);
                pending.signal?.removeEventListener('abort', pending.abort);
                if (error) reject(error);
                else resolve(payload);
            };
            const abort = () => finish(new WorkerBrokerError('ABORTED', 'Worker request was aborted'));
            const timeout = setTimeout(() => finish(new WorkerBrokerError('TIMEOUT', 'Worker request timed out')), timeoutMs);
            this.pending.set(requestId, {
                workerId,
                request,
                onAccepted,
                signal,
                abort,
                timeout,
                finish
            });
            signal?.addEventListener('abort', abort, { once: true });
            try {
                this.threadManager.postMessage(workerId, message, transfer);
            } catch {
                finish(sanitizedWorkerError());
            }
        });
    }

    terminate(workerId) {
        const state = this.workerStates.get(workerId);
        if (!state) return;
        state.unsubscribe();
        this.workerStates.delete(workerId);
        this.#rejectWorkerRequests(workerId, new WorkerBrokerError('WORKER_TERMINATED', 'Worker was terminated'));
        this.threadManager.terminate(workerId);
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        for (const workerId of [...this.workerStates.keys()]) this.terminate(workerId);
    }

    #ensureWorker(workerId) {
        if (this.workerStates.has(workerId)) return;
        const descriptor = resolveWorkerDescriptor(this.workers.get(workerId), this.allowedUrls);
        this.threadManager.spawn(workerId, descriptor.url, descriptor.options);
        const unsubscribe = this.threadManager.subscribe(workerId, event => this.#handleWorkerEvent(workerId, event));
        this.workerStates.set(workerId, { unsubscribe });
    }

    #handleWorkerEvent(workerId, event) {
        if (event?.type === 'error' || event?.data?.type === 'WORKER_ERROR') {
            this.#rejectWorkerRequests(workerId, sanitizedWorkerError());
            return;
        }
        const response = event?.data;
        let requestId;
        try {
            if (!response || Object.getPrototypeOf(response) !== Object.prototype) fail('INVALID_RESPONSE', 'Worker response must be a plain object');
            requestId = response.requestId;
            requireIdentifier(requestId, 'requestId');
        } catch {
            this.#rejectWorkerRequests(workerId, new WorkerBrokerError('INVALID_RESPONSE', 'Worker returned an invalid response'));
            return;
        }
        const pending = this.pending.get(requestId);
        if (!pending || pending.workerId !== workerId) return;
        try {
            validateBoundedPlainData(response, { ...this.limits, maxBytes: this.limits.maxResponseBytes });
            if (response.type !== 'WORKER_RESPONSE' || response.documentId !== pending.request.documentId || response.baseRevision !== pending.request.baseRevision || typeof response.ok !== 'boolean') {
                fail('INVALID_RESPONSE', 'Worker response does not match its request');
            }
            if (this.getRevision(response.documentId) !== response.baseRevision) fail('STALE_REVISION', 'Worker response base revision is stale');
            if (!response.ok) throw sanitizedWorkerError();
            if (!Object.hasOwn(response, 'payload')) fail('INVALID_RESPONSE', 'Worker response payload is missing');
            validateBoundedPlainData(response.payload, { ...this.limits, maxBytes: this.limits.maxResponseBytes });
            if (pending.onAccepted) pending.onAccepted(response.payload, {
                requestId,
                documentId: response.documentId,
                baseRevision: response.baseRevision
            });
            pending.finish(null, response.payload);
        } catch (error) {
            pending.finish(error instanceof WorkerBrokerError ? error : sanitizedWorkerError());
        }
    }

    #rejectWorkerRequests(workerId, error) {
        for (const pending of [...this.pending.values()]) {
            if (pending.workerId === workerId) pending.finish(error);
        }
    }
}
