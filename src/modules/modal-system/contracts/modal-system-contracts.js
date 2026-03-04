import { object, string, number, optional, array, enums, size, boolean } from '../../../runtime/validation/index.js';

export const ModalSystemContracts = {
    INTENT_MODAL_OPEN: {
        version: 1,
        type: 'intent',
        owner: 'modal-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to open a modal with optional props',

        schema: object({
            id: optional(string()),
            title: optional(string()),
            component: optional(string()),
            props: optional(object()),
            modalType: optional(string()),
            blocking: optional(boolean()),
            timestamp: number()
        })
    },

    INTENT_MODAL_CLOSE: {
        version: 1,
        type: 'intent',
        owner: 'modal-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to close a modal by id',

        schema: object({
            id: optional(string()),
            timestamp: number()
        })
    },

    INTENT_MODAL_CLOSE_ALL: {
        version: 1,
        type: 'intent',
        owner: 'modal-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Close all modals',

        schema: object({
            timestamp: number()
        })
    },

    MODAL_STACK_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'modal-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Emitted whenever the modal stack changes',

        schema: object({
            stack: array(object({
                id: string(),
                title: optional(string()),
                component: optional(string()),
                modalType: optional(string()),
                blocking: optional(boolean())
            })),
            timestamp: number()
        })
    },

    MODAL_ERROR: {
        version: 1,
        type: 'event',
        owner: 'modal-system',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when modal operations fail',

        schema: object({
            error: size(string(), 1, 400),
            operation: enums(['open', 'close'])
        })
    }
};
