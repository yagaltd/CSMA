const DEFAULT_OPTIONS = {
    apiEndpoint: '',
    scriptUrl: '',
    hiddenFieldName: 'captchaToken',
    widgetTagName: 'cap-widget',
    text: {},
    style: {}
};

function normalizeToken(detail) {
    if (typeof detail === 'string') return detail;
    if (!detail || typeof detail !== 'object') return '';
    return detail.token || detail.response || detail.value || '';
}

export class CapCaptchaAdapter {
    constructor() {
        this.options = { ...DEFAULT_OPTIONS };
        this.forms = new Map();
        this.scriptPromise = null;
    }

    init(options = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options,
            text: { ...DEFAULT_OPTIONS.text, ...(options.text || {}) },
            style: { ...DEFAULT_OPTIONS.style, ...(options.style || {}) }
        };
        return this;
    }

    async mount({ formId, formElement, container } = {}) {
        if (!formId) throw new Error('[CapCaptchaAdapter] mount requires formId');
        if (!container) throw new Error('[CapCaptchaAdapter] mount requires container');

        await this.#loadScript();

        const doc = container.ownerDocument || globalThis.document;
        const form = formElement || container.closest?.('form') || null;
        const widget = doc.createElement(this.options.widgetTagName || 'cap-widget');
        widget.setAttribute('data-form-id', formId);
        if (this.options.apiEndpoint) {
            widget.setAttribute('data-api-endpoint', this.options.apiEndpoint);
            widget.setAttribute('api-endpoint', this.options.apiEndpoint);
        }

        for (const [key, value] of Object.entries(this.options.text || {})) {
            if (value !== undefined && value !== null) {
                widget.setAttribute(`data-text-${key}`, String(value));
            }
        }

        for (const [key, value] of Object.entries(this.options.style || {})) {
            if (value !== undefined && value !== null) {
                widget.style.setProperty(key, String(value));
            }
        }

        const hiddenInput = this.#ensureHiddenInput({ doc, form, container });
        const record = {
            formId,
            formElement: form,
            container,
            widget,
            hiddenInput,
            token: hiddenInput.value || '',
            cleanup: []
        };

        const onSolve = (event) => {
            const token = normalizeToken(event.detail);
            if (!token) return;
            record.token = token;
            hiddenInput.value = token;
        };
        widget.addEventListener('solve', onSolve);
        widget.addEventListener('cap:solve', onSolve);
        record.cleanup.push(() => widget.removeEventListener('solve', onSolve));
        record.cleanup.push(() => widget.removeEventListener('cap:solve', onSolve));

        container.appendChild(widget);
        this.forms.set(formId, record);
        return widget;
    }

    async execute({ formId, action = 'submit' } = {}) {
        const record = this.#requireRecord(formId);
        const widget = record.widget;
        if (typeof widget.solve === 'function') {
            const result = await widget.solve({ action });
            const token = normalizeToken(result);
            if (token) {
                record.token = token;
                record.hiddenInput.value = token;
            }
        } else if (typeof widget.execute === 'function') {
            const result = await widget.execute({ action });
            const token = normalizeToken(result);
            if (token) {
                record.token = token;
                record.hiddenInput.value = token;
            }
        }
        return this.getToken({ formId });
    }

    getToken({ formId } = {}) {
        const record = this.#requireRecord(formId);
        return record.token || record.hiddenInput?.value || '';
    }

    reset({ formId } = {}) {
        const record = this.#requireRecord(formId);
        record.token = '';
        if (record.hiddenInput) record.hiddenInput.value = '';
        if (typeof record.widget?.reset === 'function') {
            record.widget.reset();
        }
    }

    getAdapterInfo() {
        return {
            id: 'captcha.cap',
            provider: 'cap',
            name: 'CAP',
            capabilities: ['self-hosted', 'proof-of-work', 'privacy-preserving', 'widget', 'programmatic']
        };
    }

    destroy() {
        for (const record of this.forms.values()) {
            for (const cleanup of record.cleanup || []) cleanup();
            record.widget?.remove?.();
        }
        this.forms.clear();
    }

    #ensureHiddenInput({ doc, form, container }) {
        const name = this.options.hiddenFieldName || 'captchaToken';
        const root = form || container;
        const escapedName = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(name)
            : String(name).replace(/"/g, '\\"');
        let input = root.querySelector?.(`input[type="hidden"][name="${escapedName}"]`);
        if (!input) {
            input = doc.createElement('input');
            input.type = 'hidden';
            input.name = name;
            root.appendChild(input);
        }
        return input;
    }

    async #loadScript() {
        if (!this.options.scriptUrl) return;
        if (this.scriptPromise) return this.scriptPromise;
        const doc = globalThis.document;
        if (!doc) return;
        const existing = doc.querySelector(`script[data-csma-captcha-cap="true"][src="${this.options.scriptUrl}"]`);
        if (existing) {
            this.scriptPromise = Promise.resolve();
            return this.scriptPromise;
        }
        this.scriptPromise = new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            script.src = this.options.scriptUrl;
            script.async = true;
            script.defer = true;
            script.dataset.csmaCaptchaCap = 'true';
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(new Error('[CapCaptchaAdapter] Failed to load CAP widget script')), { once: true });
            doc.head.appendChild(script);
        });
        return this.scriptPromise;
    }

    #requireRecord(formId) {
        if (!formId) throw new Error('[CapCaptchaAdapter] formId is required');
        const record = this.forms.get(formId);
        if (!record) throw new Error(`[CapCaptchaAdapter] CAPTCHA is not mounted for form "${formId}"`);
        return record;
    }
}
