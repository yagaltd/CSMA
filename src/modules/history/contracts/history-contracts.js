import { object, string, optional, array, number, any } from '../../../runtime/validation/index.js';
import { contract } from '../../../runtime/Contracts.js';

/**
 * History module — EventBus contracts.
 *
 * These events describe the lifecycle of an operation in the history log:
 * recorded (added), undone (reversed), redone (re-applied), and log-ready
 * (initial hydration complete).
 *
 * Sync-specific events (OPTIMISTIC_ACTION_RECORDED / _ACKED / _FAILED) are
 * NOT defined here — they belong to the optimistic-sync module. The history
 * module is sync-agnostic.
 */
export const HistoryContracts = {
    HISTORY_OP_RECORDED: contract({
        version: 1,
        type: 'event',
        owner: 'history',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a new entry is appended to the history log. Carries the full entry. Store routing for subscribers (e.g. agent-context) lives inside entry.meta.store, falling back to entry.intent.'
    }, object({
        entry: object({
            id: string(),
            intent: string(),
            payload: optional(any()),
            status: string(),
            attempts: optional(number()),
            lastError: optional(string()),
            createdAt: number(),
            updatedAt: number(),
            meta: optional(object())
        })
    })),

    HISTORY_OP_UNDONE: contract({
        version: 1,
        type: 'event',
        owner: 'history',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when the latest recorded entry is reversed via undo()'
    }, object({
        entry: object({
            id: string(),
            intent: string()
        }),
        cursor: string()
    })),

    HISTORY_OP_REDONE: contract({
        version: 1,
        type: 'event',
        owner: 'history',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a previously undone entry is re-applied via redo()'
    }, object({
        entry: object({
            id: string(),
            intent: string()
        }),
        cursor: string()
    })),

    HISTORY_LOG_READY: contract({
        version: 1,
        type: 'event',
        owner: 'history',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when the history log finishes initial hydration from the store'
    }, object({
        count: number()
    }))
};
