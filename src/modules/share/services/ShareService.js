import { ShareContracts, SHARE_LIMITS } from '../contracts/share-contracts.js';

const DEFAULT_OPTIONS = {
    maxTitleLength: SHARE_LIMITS.TITLE_MAX,
    maxTextLength: SHARE_LIMITS.TEXT_MAX,
    maxUrlLength: SHARE_LIMITS.URL_MAX,
    toastIntent: null
};

function asText(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value);
}

function trimAndCap(value, maxLength) {
    const text = asText(value).trim();
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength);
}

function isUnsafeUrl(url) {
    return /^(javascript|data|vbscript|file):/i.test(url.trim());
}

function normalizeUrl(url, maxLength) {
    if (!url && url !== '') {
        return null;
    }

    const raw = asText(url).trim();
    if (!raw) {
        return null;
    }

    if (raw.length > maxLength) {
        throw new Error(`URL exceeds maximum length of ${maxLength}`);
    }

    if (isUnsafeUrl(raw)) {
        throw new Error('Unsafe URL scheme');
    }

    try {
        const base = typeof location !== 'undefined' && location?.href ? location.href : 'https://example.invalid/';
        const parsed = new URL(raw, base);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error('Unsafe URL protocol');
        }
        return parsed.toString();
    } catch (error) {
        throw new Error(error?.message || 'Invalid URL');
    }
}

function normalizeToastIntent(options = {}) {
    if (!options) {
        return null;
    }

    if (typeof options === 'string') {
        return { eventName: options, success: null, failure: null };
    }

    if (typeof options === 'object') {
        return {
            eventName: options.eventName || options.intentName || 'INTENT_TOAST_SHOW',
            success: options.success || null,
            failure: options.failure || null
        };
    }

    return null;
}

function createDefaultState() {
    return {
        status: 'idle',
        supported: {
            webShare: false,
            clipboard: false
        },
        lastRequest: null,
        lastResult: null,
        lastError: null,
        updatedAt: 0
    };
}

function normalizeSharePayload(payload = {}, options = {}) {
    const title = trimAndCap(payload.title, options.maxTitleLength);
    const text = trimAndCap(payload.text, options.maxTextLength);
    const url = normalizeUrl(payload.url, options.maxUrlLength);

    if (!title && !text && !url) {
        throw new Error('Share request requires title, text, or url');
    }

    return {
        title: title || undefined,
        text: text || undefined,
        url: url || undefined
    };
}

function buildClipboardText(payload) {
    const lines = [];
    if (payload.title) {
        lines.push(payload.title);
    }
    if (payload.text && payload.text !== payload.title) {
        lines.push(payload.text);
    }
    if (payload.url) {
        lines.push(payload.url);
    }

    if (lines.length === 0) {
        return '';
    }

    return lines.join('\n');
}

function pickShareFields(payload = {}) {
    return {
        ...(typeof payload.title === 'string' ? { title: payload.title } : {}),
        ...(typeof payload.text === 'string' ? { text: payload.text } : {}),
        ...(typeof payload.url === 'string' ? { url: payload.url } : {})
    };
}

export class ShareService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            toastIntent: normalizeToastIntent(options.toastIntent)
        };
        this.state = createDefaultState();
        this.subscriptions = [];
    }

    init(options = {}) {
        this.options = {
            ...this.options,
            ...options,
            toastIntent: normalizeToastIntent(options.toastIntent ?? this.options.toastIntent)
        };

        this.state.supported = this.#readCapabilities();

        if (this.subscriptions.length === 0 && this.eventBus?.subscribe) {
            const unsubscribe = this.eventBus.subscribe('INTENT_SHARE_REQUEST', (payload = {}) => {
                return this.request(payload);
            });
            this.subscriptions.push(unsubscribe);
        }

        return this;
    }

    destroy() {
        this.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        this.state = createDefaultState();
    }

    canShare(payload = {}) {
        try {
            const normalized = normalizeSharePayload(payload, this.options);
            const support = this.#readCapabilities();
            return support.webShare || support.clipboard ? Boolean(normalized.title || normalized.text || normalized.url) : false;
        } catch {
            return false;
        }
    }

    getState() {
        return {
            status: this.state.status,
            supported: { ...this.state.supported },
            lastRequest: this.state.lastRequest ? { ...this.state.lastRequest } : null,
            lastResult: this.state.lastResult ? { ...this.state.lastResult } : null,
            lastError: this.state.lastError ? { ...this.state.lastError } : null,
            updatedAt: this.state.updatedAt
        };
    }

    async request(payload = {}) {
        let normalized;
        try {
            const [error, validated] = ShareContracts.INTENT_SHARE_REQUEST.schema.validate({
                ...payload,
                timestamp: payload.timestamp ?? Date.now()
            });
            if (error) {
                throw error;
            }

            normalized = normalizeSharePayload(validated, this.options);
        } catch (error) {
            return this.#fail(this.#classifyRequestError(error), error, payload);
        }

        this.state = {
            ...this.state,
            status: 'sharing',
            lastRequest: {
                ...normalized,
                source: payload.source || 'api',
                timestamp: payload.timestamp ?? Date.now()
            },
            lastError: null,
            updatedAt: Date.now()
        };

        return this.#shareWithWebAPI(normalized, payload.source || 'api');
    }

    async #shareWithWebAPI(payload, source = 'api') {
        const nav = globalThis.navigator;
        const shareFn = nav?.share;
        if (typeof shareFn !== 'function') {
            return this.#maybeFallbackToClipboard(payload, source, new Error('Web Share API unavailable'));
        }

        const data = {
            title: payload.title,
            text: payload.text,
            url: payload.url
        };

        if (typeof nav.canShare === 'function') {
            try {
                if (!nav.canShare(data)) {
                    throw new Error('Web Share API cannot share payload');
                }
            } catch (error) {
                throw error;
            }
        }

        try {
            await shareFn.call(nav, data);
            return this.#complete('web-share', payload, source);
        } catch (error) {
            return this.#maybeFallbackToClipboard(payload, source, error);
        }
    }

    async #maybeFallbackToClipboard(payload, source, shareError) {
        const clipboard = globalThis.navigator?.clipboard;
        const writeText = clipboard?.writeText;

        if (typeof writeText !== 'function') {
            return this.#fail('clipboard-unavailable', shareError || new Error('Clipboard unavailable'), payload, source);
        }

        const text = buildClipboardText(payload);
        if (!text) {
            return this.#fail('empty-content', new Error('No content available to copy'), payload, source);
        }

        try {
            await writeText.call(clipboard, text);
            return this.#complete('clipboard', payload, source);
        } catch (error) {
            return this.#fail('clipboard-failed', error, payload, source);
        }
    }

    #classifyRequestError(error) {
        const message = error?.message || String(error || '');
        if (/unsafe url/i.test(message)) {
            return 'unsafe-url';
        }
        if (/requires title, text, or url/i.test(message)) {
            return 'empty-content';
        }
        return 'invalid-payload';
    }

    #complete(transport, payload, source = 'api') {
        const timestamp = Date.now();
        const eventPayload = {
            ...payload,
            transport,
            source,
            timestamp
        };

        this.state = {
            ...this.state,
            status: 'completed',
            lastResult: { transport, timestamp },
            lastError: null,
            updatedAt: timestamp
        };

        this.#publish('SHARE_COMPLETED', eventPayload);
        this.#publishToast('success', payload, transport);

        return {
            ok: true,
            transport,
            payload: eventPayload,
            state: this.getState()
        };
    }

    #fail(reason, error, payload = {}, source = 'api') {
        const timestamp = Date.now();
        const message = error?.message || String(error || 'Share failed');
        const eventPayload = {
            ...pickShareFields(payload),
            reason,
            message,
            source,
            timestamp
        };

        this.state = {
            ...this.state,
            status: 'failed',
            lastError: { reason, message, timestamp },
            updatedAt: timestamp
        };

        this.#publish('SHARE_FAILED', eventPayload);
        this.#publishToast('failure', payload, reason, message);

        return {
            ok: false,
            reason,
            message,
            payload: eventPayload,
            state: this.getState()
        };
    }

    #publish(eventName, payload) {
        if (typeof this.eventBus?.publishSync === 'function') {
            this.eventBus.publishSync(eventName, payload);
            return;
        }
        this.eventBus?.publish?.(eventName, payload);
    }

    #publishToast(kind, payload, detail, message) {
        const toastIntent = this.options.toastIntent;
        if (!toastIntent?.eventName || !this.eventBus?.publish) {
            return;
        }

        const template = kind === 'success' ? toastIntent.success : toastIntent.failure;

        const toastPayload = {
            ...(template || {}),
            title: template?.title || (kind === 'success' ? 'Share complete' : 'Share failed'),
            description: template?.description || (kind === 'success'
                ? 'The content was shared successfully.'
                : message || 'The content could not be shared.')
        };

        this.eventBus.publish(toastIntent.eventName, toastPayload);
    }

    #readCapabilities() {
        const nav = globalThis.navigator;
        return {
            webShare: typeof nav?.share === 'function',
            clipboard: typeof nav?.clipboard?.writeText === 'function'
        };
    }
}

export function createShareService(eventBus, options = {}) {
    const service = new ShareService(eventBus, options);
    service.init(options);
    return service;
}
