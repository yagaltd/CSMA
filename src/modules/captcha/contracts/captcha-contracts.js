import { object, string, number, optional } from '../../../runtime/validation/index.js';

export const CaptchaContracts = {
    CAPTCHA_SOLVED: {
        version: 1,
        type: 'event',
        owner: 'captcha',
        lifecycle: 'active',
        stability: 'experimental',
        compliance: 'internal',
        description: 'Published when a CAPTCHA provider returns a form token',
        schema: object({
            formId: string(),
            provider: string(),
            adapter: string(),
            timestamp: optional(number())
        })
    }
};
