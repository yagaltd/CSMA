import { object, string, number, optional, enums, array, size } from '../../../runtime/validation/index.js';

export const DataTableContracts = {
    INTENT_DATA_TABLE_LOAD: {
        version: 1,
        type: 'intent',
        owner: 'data-table',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Load a data table page',

        schema: object({
            tableId: string(),
            endpoint: string(),
            page: optional(number()),
            pageSize: optional(number()),
            filters: optional(object()),
            sort: optional(object({
                field: string(),
                direction: enums(['asc', 'desc'])
            })),
            timestamp: number()
        })
    },

    INTENT_DATA_TABLE_SORT: {
        version: 1,
        type: 'intent',
        owner: 'data-table',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Sort a table by specific field and direction',

        schema: object({
            tableId: string(),
            field: string(),
            direction: enums(['asc', 'desc']),
            timestamp: number()
        })
    },

    INTENT_DATA_TABLE_FILTER: {
        version: 1,
        type: 'intent',
        owner: 'data-table',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Apply filters to a table',

        schema: object({
            tableId: string(),
            filters: object(),
            timestamp: number()
        })
    },

    DATA_TABLE_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'data-table',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Published when table rows, pagination, or sorting changes',

        schema: object({
            tableId: string(),
            rows: array(object()),
            page: number(),
            pageSize: number(),
            total: optional(number()),
            sort: optional(object({
                field: string(),
                direction: enums(['asc', 'desc'])
            })),
            filters: optional(object()),
            timestamp: number()
        })
    },

    DATA_TABLE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'data-table',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'internal',
        description: 'Emitted when data table fetch fails',

        schema: object({
            tableId: string(),
            error: size(string(), 1, 400),
            timestamp: number()
        })
    }
};
