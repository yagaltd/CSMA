import { CheckoutService } from './services/CheckoutService.js';

export const manifest = {
    name: 'Checkout Module',
    version: '1.0.0',
    description: 'Cart + payment orchestration',
    dependencies: ['formManager'],
    bundleSize: '+7KB',
    contracts: [
        'INTENT_CHECKOUT_START',
        'INTENT_CHECKOUT_SUBMIT',
        'INTENT_CHECKOUT_RESET',
        'CHECKOUT_STATE_CHANGED',
        'CHECKOUT_COMPLETED',
        'CHECKOUT_ERROR'
    ]
};

export const services = {
    checkout: CheckoutService
};

export function createCheckout(eventBus, options = {}) {
    const service = new CheckoutService(eventBus, options);
    service.init(options);
    return service;
}
