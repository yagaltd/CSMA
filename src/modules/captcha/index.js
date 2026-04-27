import { CaptchaModuleService } from './services/CaptchaModuleService.js';
import { CapCaptchaAdapter } from './adapters/CapCaptchaAdapter.js';
import { CaptchaContracts } from './contracts/captcha-contracts.js';

export const manifest = {
    id: 'captcha',
    name: 'Captcha Module',
    version: '1.0.0',
    description: 'CAPTCHA provider orchestration for public form submissions',
    dependencies: [],
    services: ['captcha', 'captchaCapAdapter'],
    bundleSize: '+4KB',
    contracts: Object.keys(CaptchaContracts),
    contributes: {
        adapters: [
            {
                id: 'captcha.cap',
                type: 'captcha-provider',
                serviceName: 'captchaCapAdapter',
                capabilities: ['self-hosted', 'proof-of-work', 'privacy-preserving', 'widget', 'programmatic']
            }
        ]
    }
};

export const services = {
    captcha: CaptchaModuleService,
    captchaCapAdapter: CapCaptchaAdapter
};

export { CaptchaModuleService, CapCaptchaAdapter, CaptchaContracts };
