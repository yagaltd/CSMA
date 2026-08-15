import { object, string, boolean, number, any, optional } from '../../../runtime/validation/index.js';

/**
 * optimistic-sync module — EventBus contracts.
 *
 * Local action tracking events (OPTIMISTIC_ACTION_*) carry history entries
 * whose internal shape is owned by the history module; the payload envelope
 * is validated, the entry itself passes through as `any()`.
 *
 * Channel/transport message events (CHANNEL_SERVER_*, CHANNEL_ACCESS_DENIED,
 * CHANNEL_COMMAND_RESULT, ISLAND_INVALIDATED, OPTIMISTIC_INVALIDATION,
 * OPTIMISTIC_SERVER_REWORK, OPTIMISTIC_TRANSPORT_ACK/REPLAY) relay messages
 * produced by the server or other tabs (via TransportMessageGuard); their
 * full shape is server-driven, so the schema is `any()` to avoid false
 * contract drops on valid traffic.
 *
 * Note: CHANNEL_SERVER_CLOSE is also published by the runtime ChannelManager
 * (registered in src/runtime/Contracts.js). It is registered here as well
 * because SyncTransportService independently emits it on channel close
 * frames; the duplicate registration is intentional (see audit plan §Lane R2).
 */

const ENTRY_ENVELOPE = object({
    entry: any()
});

export const OptimisticSyncContracts = {
    // ── Local action tracking (OptimisticSyncService / SyncStateTracker) ──

    OPTIMISTIC_ACTION_RECORDED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Re-emitted when an action is recorded in the history log',
        schema: ENTRY_ENVELOPE
    },

    OPTIMISTIC_ACTION_INGESTED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Re-emitted when a proxied action is ingested into the history log',
        schema: ENTRY_ENVELOPE
    },

    OPTIMISTIC_ACTION_ACKED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the server acknowledges an action and it is removed from the log',
        schema: ENTRY_ENVELOPE
    },

    OPTIMISTIC_ACTION_FAILED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when an action fails locally or terminally',
        schema: object({
            entry: any(),
            terminal: boolean(),
            error: optional(string())
        })
    },

    OPTIMISTIC_ACTION_DROPPED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when conflict resolution drops an action',
        schema: object({
            entry: any(),
            reason: string()
        })
    },

    OPTIMISTIC_ACTION_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when conflict resolution updates an action payload for retry',
        schema: object({
            entryId: string(),
            reason: string()
        })
    },

    OPTIMISTIC_CRDT_STATE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when a CRDT reducer updates a registered key',
        schema: object({
            reducerId: string(),
            key: any(),
            value: any(),
            strategy: string(),
            source: optional(any()),
            updatedAt: number()
        })
    },

    // ── Transport lifecycle (SyncTransportService) ──

    OPTIMISTIC_TRANSPORT_STATE: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the transport connection state changes',
        schema: object({
            state: string()
        })
    },

    OPTIMISTIC_TRANSPORT_ACK: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the transport receives an ack for a pending intent',
        schema: any()
    },

    OPTIMISTIC_TRANSPORT_REPLAY: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the transport receives a replay message',
        schema: any()
    },

    OPTIMISTIC_INVALIDATION: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when an invalidation payload is received',
        schema: any()
    },

    OPTIMISTIC_SERVER_REWORK: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the server requests rework of recorded actions',
        schema: any()
    },

    // ── Channel server frames (SyncTransportService) ──

    CHANNEL_SERVER_EVENT: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published for channel ack frames relayed from the server',
        schema: any()
    },

    CHANNEL_SERVER_SNAPSHOT: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the server sends a channel snapshot',
        schema: any()
    },

    CHANNEL_SERVER_INVALIDATE: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the server invalidates channel state',
        schema: any()
    },

    CHANNEL_SERVER_REPLAY: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the server replays channel history',
        schema: any()
    },

    // CHANNEL_SERVER_CLOSE is registered by the runtime (src/runtime/Contracts.js)
    // with a typed looseObject schema covering both publishers (ChannelManager
    // teardown and SyncTransportService protocol frames). Keep exactly one
    // registration to avoid ModuleManager overwrite-on-load shadowing.

    CHANNEL_ACCESS_DENIED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the server denies channel access',
        schema: any()
    },

    CHANNEL_COMMAND_RESULT: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when a channel command result frame is received',
        schema: any()
    },

    ISLAND_INVALIDATED: {
        version: 1,
        type: 'event',
        owner: 'optimistic-sync',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when an island invalidation frame is received',
        schema: any()
    }
};
