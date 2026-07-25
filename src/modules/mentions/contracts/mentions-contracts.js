import {
    object,
    string,
    number,
    array,
    any,
    optional,
    size
} from '../../../runtime/validation/index.js';

export const MentionsContracts = {
    MENTION_DETECTED: {
        version: 1,
        type: 'event',
        owner: 'mentions',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Mentions detected in a text body — dispatched after parsing',
        security: {
            rateLimits: { requests: 120, windowMs: 60000, scope: 'session' }
        },
        schema: object({
            source: size(string(), 1, 120),
            sourceId: size(string(), 1, 160),
            body: string(),
            mentions: array(object({
                type: size(string(), 1, 40),
                raw: string(),
                start: number(),
                end: number(),
                id: optional(size(string(), 0, 160))
            })),
            context: object({
                docType: optional(string()),
                surroundingContent: optional(string()),
                editorId: optional(string())
            }),
            timestamp: number()
        })
    },

    MENTION_AI_TASK_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'mentions',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'AI task for an @ai mention completed (success or error)',
        security: {
            rateLimits: { requests: 60, windowMs: 60000, scope: 'session' }
        },
        schema: object({
            source: string(),
            sourceId: string(),
            mention: object({
                type: string(),
                id: optional(string()),
                raw: string(),
                start: number(),
                end: number()
            }),
            response: optional(string()),
            error: optional(string()),
            timestamp: number()
        })
    }
};
