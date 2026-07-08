import { object, string, number } from '../../../../src/runtime/validation/index.js';

export const ExampleModuleContracts = {
    EXAMPLE_MODULE_EVENT: {
        version: 1,
        type: 'event',
        owner: 'example-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Sample event emitted by the example module',

        schema: object({
            id: string(),
            message: string(),
            timestamp: number()
        })
    },

    EXAMPLE_MODULE_VIEW_RENDERED: {
        version: 1,
        type: 'event',
        owner: 'example-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Sample event emitted when the example module renders a registered view',

        schema: object({
            id: string(),
            viewId: string(),
            target: string(),
            title: string(),
            message: string(),
            tone: string(),
            timestamp: number()
        })
    }
};
