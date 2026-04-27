import { describe, expect, it, vi } from 'vitest';
import { AdapterRegistry } from '../src/runtime/AdapterRegistry.js';
import { EventBus } from '../src/runtime/EventBus.js';
import { ServiceManager } from '../src/runtime/ServiceManager.js';
import { CaptchaModuleService } from '../src/modules/captcha/services/CaptchaModuleService.js';

class FakeAdapter {
    constructor() {
        this.init = vi.fn(() => this);
    }
}

function createRegistry(adapter = new FakeAdapter()) {
    const eventBus = new EventBus();
    const serviceManager = new ServiceManager(eventBus);
    const adapterRegistry = new AdapterRegistry({ eventBus, serviceManager });
    serviceManager.register('fakeCaptchaAdapter', adapter);
    adapterRegistry.register('captcha', {
        id: 'captcha.fake',
        type: 'captcha-provider',
        serviceName: 'fakeCaptchaAdapter'
    });
    return { adapter, adapterRegistry };
}

describe('CaptchaModuleService', () => {
    it('requires an adapter registry', () => {
        const service = new CaptchaModuleService();
        expect(() => service.init()).toThrow('[Captcha] CaptchaModuleService.init requires adapterRegistry');
    });

    it('fails clearly when the requested adapter is unavailable', () => {
        const { adapterRegistry } = createRegistry();
        const service = new CaptchaModuleService();

        expect(() => service.init({ adapterRegistry, adapter: 'captcha.missing' }))
            .toThrow('[Captcha] Adapter "captcha.missing" is not registered or has no service');
    });

    it('resolves the requested adapter and forwards options', () => {
        const { adapter, adapterRegistry } = createRegistry();
        const service = new CaptchaModuleService();

        expect(service.init({
            adapterRegistry,
            adapter: 'captcha.fake',
            apiEndpoint: '/cap',
            hiddenFieldName: 'captchaToken'
        })).toBe(service);

        expect(adapter.init).toHaveBeenCalledWith(expect.objectContaining({
            adapterRegistry,
            adapter: 'captcha.fake',
            apiEndpoint: '/cap',
            hiddenFieldName: 'captchaToken'
        }));
    });
});
