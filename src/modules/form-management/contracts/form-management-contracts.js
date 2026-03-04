import { object, string, number, optional, enums, boolean, any } from '../../../runtime/validation/index.js';

export const FormManagementContracts = {
    INTENT_FORM_REGISTER: {
        version: 1,
        type: 'intent',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Register or hydrate a form instance',

        schema: object({
            formId: string(),
            schema: optional(any()),
            initialValues: optional(object()),
            metadata: optional(object()),
            autoSave: optional(boolean()),
            autoSaveDelay: optional(number()),
            timestamp: number()
        })
    },

    INTENT_FORM_UPDATE_FIELD: {
        version: 1,
        type: 'intent',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Update a single form field value',

        schema: object({
            formId: string(),
            name: string(),
            value: any(),
            validate: optional(boolean()),
            timestamp: number()
        })
    },

    INTENT_FORM_SUBMIT: {
        version: 1,
        type: 'intent',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Submit a form and emit payload downstream',

        schema: object({
            formId: string(),
            strategy: optional(enums(['direct', 'queue'])),
            metadata: optional(object()),
            jobType: optional(string()),
            timestamp: number()
        })
    },

    INTENT_FORM_RESET: {
        version: 1,
        type: 'intent',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Reset form state to initial values',

        schema: object({
            formId: string(),
            values: optional(object()),
            timestamp: number()
        })
    },

    FORM_STATE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published whenever form state mutates',

        schema: object({
            formId: string(),
            state: object(),
            timestamp: number()
        })
    },

    FORM_FIELD_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Emitted after a single field changes',

        schema: object({
            formId: string(),
            name: string(),
            value: any(),
            errors: optional(object()),
            valid: boolean(),
            timestamp: number()
        })
    },

    FORM_SUBMITTED: {
        version: 1,
        type: 'event',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published after a form passes validation and broadcasts values',

        schema: object({
            formId: string(),
            values: object(),
            metadata: optional(object()),
            integrity: optional(object({
                intent: string(),
                nonce: string(),
                signature: string(),
                timestamp: number(),
                expiresAt: number()
            })),
            submittedAt: number()
        })
    },

    FORM_ERROR: {
        version: 1,
        type: 'event',
        owner: 'form-management',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published whenever validation or queue processing fails',

        schema: object({
            formId: string(),
            errors: object(),
            timestamp: number()
        })
    }
};
