import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/runtime/EventBus.js';
import { CheckoutService } from '../src/modules/checkout/services/CheckoutService.js';
import { FormManagementService } from '../src/modules/form-management/services/FormManagementService.js';

function createCheckout({ captchaToken = 'captcha-token', submitHandler } = {}) {
    const eventBus = new EventBus();
    const captchaService = {
        getToken: vi.fn(() => captchaToken),
        execute: vi.fn(() => captchaToken),
        getAdapterInfo: vi.fn(() => ({ id: 'captcha.cap', provider: 'cap' }))
    };
    const formService = new FormManagementService(eventBus, { captchaService });
    formService.init({ captchaService });
    const checkout = new CheckoutService(eventBus, {
        formService,
        submitHandler: submitHandler || vi.fn(async () => ({ orderId: 'order-1' }))
    });
    checkout.init({ formService });
    return { eventBus, captchaService, formService, checkout };
}

describe('CheckoutService CAPTCHA preflight', () => {
    it('blocks checkout when a captcha-required form has no token', async () => {
        const submitHandler = vi.fn(async () => ({ orderId: 'order-1' }));
        const { checkout } = createCheckout({ captchaToken: '', submitHandler });
        const checkoutId = checkout.startSession({
            checkoutId: 'secure-checkout',
            items: [{ id: 'sku-1', name: 'Plan', price: 10, quantity: 1 }],
            metadata: {
                email: 'buyer@example.com',
                name: 'Buyer',
                address: '123 Main',
                captcha: { required: true }
            }
        });

        const result = await checkout.submit({ checkoutId });

        expect(result).toEqual({
            success: false,
            errors: { captcha: 'Captcha verification is required' }
        });
        expect(submitHandler).not.toHaveBeenCalled();
        expect(checkout.sessions.get(checkoutId).status).toBe('error');
    });

    it('runs captcha preflight before checkout submission and forwards captcha metadata', async () => {
        const submitHandler = vi.fn(async () => ({ orderId: 'order-1' }));
        const { checkout, captchaService } = createCheckout({ submitHandler });
        const checkoutId = checkout.startSession({
            checkoutId: 'secure-checkout',
            items: [{ id: 'sku-1', name: 'Plan', price: 10, quantity: 2 }],
            metadata: {
                email: 'buyer@example.com',
                name: 'Buyer',
                address: '123 Main',
                captcha: { required: true, action: 'checkout' }
            }
        });

        const result = await checkout.submit({ checkoutId });

        expect(result).toEqual(expect.objectContaining({
            success: true,
            orderId: 'order-1',
            captcha: {
                provider: 'cap',
                adapter: 'captcha.cap',
                token: 'captcha-token'
            }
        }));
        expect(captchaService.getToken).toHaveBeenCalledWith({ formId: 'checkout.form.secure-checkout' });
        expect(submitHandler).toHaveBeenCalledWith(expect.objectContaining({
            checkoutId,
            captcha: {
                provider: 'cap',
                adapter: 'captcha.cap',
                token: 'captcha-token'
            }
        }));
        expect(checkout.sessions.get(checkoutId).status).toBe('completed');
    });
});
