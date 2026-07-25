import { object, string, boolean, optional, number, any } from '../../../runtime/validation/index.js';
import { contract } from '../../../runtime/Contracts.js';

/**
 * Agent Context contracts.
 *
 * These are observability events published by AgentContextService. The
 * actual serialized data moves through the return value of `get()` and is
 * NOT carried by these events (they describe what was queried / registered,
 * not the content).
 */
export const AgentContextContracts = {
    AGENT_CONTEXT_QUERIED: contract(
        {
            version: 1,
            type: 'event',
            owner: 'agent-context',
            lifecycle: 'active',
            stability: 'stable',
            compliance: 'public',
            description: 'Published when an agent queries a store through AgentContextService.get(). Carries metadata only — never the serialized payload.'
        },
        object({
            store: string(),
            format: string(),
            id: optional(string()),
            bytes: number(),
            truncated: boolean(),
            cursor: optional(string())
        })
    ),

    AGENT_CONTEXT_REGISTERED: contract(
        {
            version: 1,
            type: 'event',
            owner: 'agent-context',
            lifecycle: 'active',
            stability: 'stable',
            compliance: 'public',
            description: 'Published when a context serializer is registered (either via manifest contribution or explicit register() call).'
        },
        object({
            moduleId: string(),
            store: string(),
            format: string(),
            label: optional(string()),
            isDefault: optional(boolean())
        })
    ),

    AGENT_CONTEXT_UNREGISTERED: contract(
        {
            version: 1,
            type: 'event',
            owner: 'agent-context',
            lifecycle: 'active',
            stability: 'stable',
            compliance: 'public',
            description: 'Published when a module\'s serializers are unregistered.'
        },
        object({
            moduleId: string(),
            count: number()
        })
    ),

    AGENT_CONTEXT_INVALIDATED: contract(
        {
            version: 1,
            type: 'event',
            owner: 'agent-context',
            lifecycle: 'active',
            stability: 'stable',
            compliance: 'public',
            description: 'Published when outstanding cursors are invalidated (e.g. a new serializer replaced an existing one for the same store+format).'
        },
        object({
            store: string(),
            format: string(),
            reason: string(),
            details: optional(any())
        })
    )
};
