const DEFAULT_ADAPTER_ID = 'captcha.cap';
const CAPTCHA_ADAPTER_TYPE = 'captcha-provider';

export class CaptchaModuleService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = {
            adapter: DEFAULT_ADAPTER_ID,
            ...options
        };
        this.adapter = null;
        this.adapterId = null;
    }

    init(options = {}) {
        this.options = {
            ...this.options,
            ...options,
            adapter: options.adapter || this.options.adapter || DEFAULT_ADAPTER_ID
        };

        const adapterRegistry = this.options.adapterRegistry;
        if (!adapterRegistry) {
            throw new Error('[Captcha] CaptchaModuleService.init requires adapterRegistry');
        }

        this.adapterId = this.options.adapter;
        const adapter = adapterRegistry.resolve(CAPTCHA_ADAPTER_TYPE, this.adapterId);
        if (!adapter) {
            throw new Error(`[Captcha] Adapter "${this.adapterId}" is not registered or has no service`);
        }

        this.adapter = adapter;
        this.adapter.init?.(this.options);
        return this;
    }

    mount(args) {
        this.#ensureAdapter();
        return this.adapter.mount(args);
    }

    execute(args) {
        this.#ensureAdapter();
        return this.adapter.execute(args);
    }

    getToken(args) {
        this.#ensureAdapter();
        return this.adapter.getToken(args);
    }

    reset(args) {
        this.#ensureAdapter();
        return this.adapter.reset(args);
    }

    getAdapterInfo() {
        this.#ensureAdapter();
        const info = this.adapter.getAdapterInfo?.() || {};
        return {
            adapter: this.adapterId,
            provider: info.provider || this.adapterId,
            ...info
        };
    }

    destroy() {
        this.adapter?.destroy?.();
        this.adapter = null;
    }

    #ensureAdapter() {
        if (!this.adapter) {
            this.init(this.options);
        }
    }
}
