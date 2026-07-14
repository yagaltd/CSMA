import { describe, expect, it, vi } from 'vitest';
import { WorkerBroker, WorkerBrokerError } from '../src/runtime/WorkerBroker.js';
import { createDocumentCapabilityValidator } from '../src/runtime/DocumentCapabilities.js';

class FakeThreadManager {
    constructor() {
        this.handlers = new Map();
        this.posts = [];
        this.spawned = [];
        this.terminated = [];
    }

    spawn(id, url, options) {
        this.spawned.push({ id, url, options });
        return id;
    }

    subscribe(id, handler) {
        this.handlers.set(id, handler);
        return () => this.handlers.delete(id);
    }

    postMessage(id, message, transfer) {
        this.posts.push({ id, message, transfer });
    }

    terminate(id) {
        this.terminated.push(id);
    }

    respond(id, response) {
        this.handlers.get(id)?.({ data: response });
    }

    error(id, detail = 'secret worker internals') {
        this.handlers.get(id)?.({ type: 'error', data: { type: 'WORKER_ERROR', error: detail } });
    }
}

function setup({ revision = 4, limits = {}, capabilities, validateCapability } = {}) {
    let currentRevision = revision;
    const manager = new FakeThreadManager();
    const capabilityRecords = capabilities ?? new Map([
        ['cap-worker', {
            id: 'cap-worker',
            documentId: 'doc-1',
            originKind: 'worker',
            intents: ['agent.transform'],
            baseRevision: revision,
            revoked: false
        }]
    ]);
    const capabilityValidator = validateCapability ?? createDocumentCapabilityValidator({
        documentId: 'doc-1',
        getRevision: () => currentRevision,
        resolveCapability: id => capabilityRecords.get(id)
    });
    const broker = new WorkerBroker({
        threadManager: manager,
        workers: {
            transformer: () => ({ url: '/workers/transformer.js', options: { type: 'module' } })
        },
        allowedUrls: ['/workers/transformer.js'],
        capabilityValidator,
        getRevision: () => currentRevision,
        limits: { timeoutMs: 100, ...limits }
    });
    const envelope = {
        documentId: 'doc-1',
        baseRevision: revision,
        intent: 'agent.transform',
        origin: { kind: 'worker', capabilityId: 'cap-worker' },
        payload: { text: 'hello' }
    };
    return {
        broker,
        manager,
        envelope,
        setRevision(value) { currentRevision = value; }
    };
}

function successfulResponse(post, payload = { text: 'HELLO' }) {
    return {
        type: 'WORKER_RESPONSE',
        requestId: post.message.requestId,
        documentId: post.message.documentId,
        baseRevision: post.message.baseRevision,
        ok: true,
        payload
    };
}

async function waitForPost(manager, count = 1) {
    await vi.waitFor(() => expect(manager.posts).toHaveLength(count));
    return manager.posts[count - 1];
}

describe('WorkerBroker runtime security', () => {
    it('returns a validated response, forwards transfer lists, and invokes accepted state exactly once', async () => {
        const { broker, manager, envelope } = setup();
        const accepted = vi.fn();
        const buffer = new ArrayBuffer(4);
        const resultPromise = broker.request('transformer', {
            ...envelope,
            payload: { text: 'hello', buffer }
        }, { transfer: [buffer], onAccepted: accepted });
        const post = await waitForPost(manager);

        expect(post.transfer).toEqual([buffer]);
        expect(post.message.requestId).toMatch(/^[-A-Za-z0-9._:]+$/);
        expect(post.message).not.toHaveProperty('origin');
        manager.respond('transformer', successfulResponse(post));

        await expect(resultPromise).resolves.toEqual({ text: 'HELLO' });
        expect(accepted).toHaveBeenCalledOnce();
        expect(broker.pendingCount).toBe(0);
        expect(manager.spawned).toEqual([{
            id: 'transformer',
            url: '/workers/transformer.js',
            options: { type: 'module' }
        }]);
    });

    it('rejects malformed response schemas without running state callbacks', async () => {
        const { broker, manager, envelope } = setup();
        const accepted = vi.fn();
        const resultPromise = broker.request('transformer', envelope, { onAccepted: accepted });
        const post = await waitForPost(manager);
        manager.respond('transformer', {
            ...successfulResponse(post),
            baseRevision: '4'
        });

        await expect(resultPromise).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
        expect(accepted).not.toHaveBeenCalled();
        expect(broker.pendingCount).toBe(0);
    });

    it('rejects unauthorized origins and intents before spawning or posting', async () => {
        const { broker, manager, envelope } = setup();
        await expect(broker.request('transformer', {
            ...envelope,
            intent: 'document.replaceAll',
            origin: { kind: 'component', capabilityId: 'cap-worker' }
        })).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Worker request is not authorized' });
        expect(manager.spawned).toHaveLength(0);
        expect(manager.posts).toHaveLength(0);
        expect(broker.pendingCount).toBe(0);
    });

    it('normalizes a stale SourceDocumentSession capability rejection', async () => {
        const stale = new Error('internal session detail');
        stale.code = 'stale-revision';
        const { broker, manager, envelope } = setup({
            validateCapability: () => { throw stale; }
        });

        await expect(broker.request('transformer', envelope)).rejects.toMatchObject({
            code: 'STALE_REVISION',
            message: 'Worker request base revision is stale'
        });
        expect(manager.posts).toHaveLength(0);
    });

    it('times out and cleans the pending request', async () => {
        const { broker, manager, envelope } = setup({ limits: { timeoutMs: 20 } });
        const accepted = vi.fn();
        const resultPromise = broker.request('transformer', envelope, { timeoutMs: 5, onAccepted: accepted });

        await expect(resultPromise).rejects.toMatchObject({ code: 'TIMEOUT', message: 'Worker request timed out' });
        expect(accepted).not.toHaveBeenCalled();
        expect(manager.posts).toHaveLength(1);
        expect(broker.pendingCount).toBe(0);
    });

    it('aborts an in-flight request and ignores its later response', async () => {
        const { broker, manager, envelope } = setup();
        const accepted = vi.fn();
        const controller = new AbortController();
        const resultPromise = broker.request('transformer', envelope, {
            signal: controller.signal,
            onAccepted: accepted
        });
        const post = await waitForPost(manager);
        controller.abort();

        await expect(resultPromise).rejects.toMatchObject({ code: 'ABORTED' });
        manager.respond('transformer', successfulResponse(post));
        expect(accepted).not.toHaveBeenCalled();
        expect(broker.pendingCount).toBe(0);
    });

    it('rejects a response after the document revision advances', async () => {
        const { broker, manager, envelope, setRevision } = setup();
        const accepted = vi.fn();
        const resultPromise = broker.request('transformer', envelope, { onAccepted: accepted });
        const post = await waitForPost(manager);
        setRevision(5);
        manager.respond('transformer', successfulResponse(post));

        await expect(resultPromise).rejects.toMatchObject({ code: 'STALE_REVISION' });
        expect(accepted).not.toHaveBeenCalled();
        expect(broker.pendingCount).toBe(0);
    });

    it('rejects oversized and prototype-polluting request payloads before posting', async () => {
        const oversized = setup({ limits: { maxRequestBytes: 80 } });
        await expect(oversized.broker.request('transformer', {
            ...oversized.envelope,
            payload: { text: 'x'.repeat(100) }
        })).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
        expect(oversized.manager.posts).toHaveLength(0);

        const forbidden = setup();
        const payload = Object.create(null);
        Object.defineProperty(payload, 'constructor', { enumerable: true, value: { polluted: true } });
        await expect(forbidden.broker.request('transformer', {
            ...forbidden.envelope,
            payload
        })).rejects.toMatchObject({ code: 'FORBIDDEN_PAYLOAD_KEY' });
        expect(forbidden.manager.posts).toHaveLength(0);
    });

    it('rejects oversized worker responses without running state callbacks', async () => {
        const { broker, manager, envelope } = setup({ limits: { maxResponseBytes: 220 } });
        const accepted = vi.fn();
        const resultPromise = broker.request('transformer', envelope, { onAccepted: accepted });
        const post = await waitForPost(manager);
        manager.respond('transformer', successfulResponse(post, { text: 'x'.repeat(300) }));

        await expect(resultPromise).rejects.toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
        expect(accepted).not.toHaveBeenCalled();
        expect(broker.pendingCount).toBe(0);
    });

    it('sanitizes worker errors and rejects every affected pending request', async () => {
        const { broker, manager, envelope } = setup();
        const first = broker.request('transformer', envelope);
        const second = broker.request('transformer', envelope);
        await waitForPost(manager, 2);
        manager.error('transformer', '/private/path.js: secret token');

        for (const result of [first, second]) {
            await expect(result).rejects.toEqual(expect.objectContaining({
                code: 'WORKER_ERROR',
                message: 'Worker request failed'
            }));
            await result.catch(error => expect(error.message).not.toContain('secret'));
        }
        expect(broker.pendingCount).toBe(0);
    });

    it('terminates workers, unsubscribes handlers, and rejects outstanding requests', async () => {
        const { broker, manager, envelope } = setup();
        const resultPromise = broker.request('transformer', envelope);
        await waitForPost(manager);
        expect(manager.handlers.has('transformer')).toBe(true);

        broker.close();

        await expect(resultPromise).rejects.toBeInstanceOf(WorkerBrokerError);
        await resultPromise.catch(error => expect(error.code).toBe('WORKER_TERMINATED'));
        expect(manager.handlers.has('transformer')).toBe(false);
        expect(manager.terminated).toEqual(['transformer']);
        expect(broker.pendingCount).toBe(0);
        expect(() => broker.close()).not.toThrow();
    });
});
