import { object, string, number, optional, enums, array, size } from '../../../runtime/validation/index.js';

export const CheckoutContracts = {
    INTENT_CHECKOUT_START: {
        version: 1,
        type: 'intent',
        owner: 'checkout',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Begin a checkout session',

        schema: object({
            checkoutId: optional(string()),
            items: array(object({
                id: string(),
                name: string(),
                price: number(),
                quantity: number()
            })),
            currency: optional(string()),
            metadata: optional(object()),
            timestamp: number()
        })
    },

    INTENT_CHECKOUT_SUBMIT: {
        version: 1,
        type: 'intent',
        owner: 'checkout',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Submit checkout forms for processing',

        schema: object({
            checkoutId: string(),
            strategy: optional(enums(['direct', 'queue'])),
            timestamp: number()
        })
    },

    INTENT_CHECKOUT_RESET: {
        version: 1,
        type: 'intent',
        owner: 'checkout',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Reset checkout session state',

        schema: object({
            checkoutId: string(),
            timestamp: number()
        })
    },

    CHECKOUT_STATE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'checkout',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when checkout state (totals, status) changes',

        schema: object({
            checkoutId: string(),
            status: enums(['idle', 'pending', 'in_progress', 'queued', 'completed', 'error']),
            totals: optional(object({
                subtotal: number(),
                tax: number(),
                total: number()
            })),
            items: optional(array(object({
                id: string(),
                name: string(),
                price: number(),
                quantity: number()
            }))),
            timestamp: number()
        })
    },

    CHECKOUT_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'checkout',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published after checkout is successfully processed',

        schema: object({
            checkoutId: string(),
            orderId: string(),
            totals: object({
                subtotal: number(),
                tax: number(),
                total: number()
            }),
            timestamp: number()
        })
    },

    CHECKOUT_ERROR: {
        version: 1,
        type: 'event',
        owner: 'checkout',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Emitted when checkout processing fails',

        schema: object({
            checkoutId: string(),
            error: size(string(), 1, 400),
            timestamp: number()
        })
    }
};
