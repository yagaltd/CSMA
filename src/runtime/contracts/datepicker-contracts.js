/**
 * CSMA datepicker contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, number, enums, optional } from '../validation/index.js';

export const DatepickerContracts = {
    // Datepicker Events
    DATE_SELECTED: {
        version: 1,
        type: 'event',
        owner: 'date-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User selected a date',

        schema: object({
            date: string(),
            timestamp: number(),
            year: number(),
            month: number(),
            day: number(),
            instanceId: number(),
            startDate: optional(string()),
            endDate: optional(string())
        })
    },

    CALENDAR_RENDERED: {
        version: 1,
        type: 'event',
        owner: 'date-service',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Calendar view updated (month/year change)',

        schema: object({
            year: number(),
            month: number(),
            direction: enums(['prev', 'next']),
            timestamp: number()
        })
    },
};
