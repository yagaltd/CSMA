import { object, string, number } from '../../../runtime/validation/index.js';

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
    }
};
