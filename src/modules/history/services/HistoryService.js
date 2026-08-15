import { HistoryStore, DEFAULT_DB_NAME, DEFAULT_STORE_NAME } from './HistoryStore.js';
import { BroadcastSync, DEFAULT_CHANNEL_NAME } from './BroadcastSync.js';
import { uid } from '../../../utils/id.js';

const CRDT_TYPES = new Set(['lww-register', 'g-counter', 'pn-counter']);

/**
 * HistoryService — generic, sync-agnostic do/undo/redo + append-only operation log.
 *
 * Extracted from the former ActionLogService. Owns the LOG only (record, ingest,
 * undo, redo, query, persistence, multi-tab broadcast). Sync semantics
 * (acked / failed / pending / updatePayload) live in the optimistic-sync module
 * via its SyncStateTracker, which decorates a view of these entries.
 *
 * Status values on entries: 'recorded' (default), 'undone' (reversed via undo),
 * 'redone' (re-applied after undo via redo).
 *
 * Multi-tab note (plan open question #3): tabs sync via BroadcastChannel +
 * store reload, but no leader election. Concurrent undo() across tabs can
 * diverge — accepted for v1 (single-user local-first).
 */
export class HistoryService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.actions = [];
        this._clock = Date.now();
        this.ready = Promise.resolve();
        this.store = null;
        this.broadcastSync = null;
        /**
         * Navigation cursor for undo/redo. The actions array is sorted newest-first,
         * so `_undoDepth` counts how many entries from the tip are currently undone.
         * - _undoDepth = 0  → at tip, nothing undone
         * - _undoDepth = N  → first N entries (actions[0..N-1]) are 'undone'
         */
        this._undoDepth = 0;
        this._lastUndoId = null;
        this._lastRedoId = null;
    }

    async init(options = {}) {
        const {
            store,
            broadcast = true,
            broadcastChannel,
            dbName = DEFAULT_DB_NAME,
            storeName = DEFAULT_STORE_NAME
        } = options;

        this.store = store || new HistoryStore({ dbName, storeName });
        this.ready = this.store.init();
        await this.ready;
        this.actions = this._sort(await this.store.getAll());
        this._resetUndoDepth();

        if (broadcast) {
            this.broadcastSync = new BroadcastSync({
                channelName: broadcastChannel || this.store.storeName || DEFAULT_CHANNEL_NAME,
                onMessage: (msg) => this._handleBroadcast(msg)
            });
            this.broadcastSync.init();
        }

        this.eventBus?.publish?.('HISTORY_LOG_READY', { count: this.actions.length });
    }

    destroy() {
        this.broadcastSync?.destroy();
        this.broadcastSync = null;
    }

    // ─── Append ────────────────────────────────────────────────────────

    record(intent, payload, options = {}) {
        const entry = this._normalizeEntry({
            id: HistoryService._createId(),
            intent,
            payload,
            status: 'recorded',
            attempts: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            meta: this._createMeta({
                channels: options.channels,
                undo: options.undo,
                reducer: options.reducer,
                actionCreator: options.actionCreator,
                crdt: options.crdt,
                actor: options.actor
            })
        });
        this.actions.unshift(entry);
        this.actions = this._sort(this.actions);
        // Newly recorded entry sits at the tip; reset redo frontier (any prior
        // 'undone' entries beyond this point cannot be redone now — branch reset).
        this._trimRedoFrontier();
        this._undoDepth = 0;
        this._persistEntry(entry);
        this._broadcastChange();
        this.eventBus?.publish?.('HISTORY_OP_RECORDED', { entry });
        return entry;
    }

    async ingest(entry, { emit = true } = {}) {
        if (!entry?.id) return null;
        await this.ready;
        const normalized = this._normalizeEntry(entry);
        const index = this.actions.findIndex(item => item.id === normalized.id);
        if (index > -1) {
            this.actions[index] = {
                ...this.actions[index],
                ...normalized,
                meta: {
                    ...this.actions[index].meta,
                    ...normalized.meta
                }
            };
        } else {
            this.actions.push(normalized);
            this.actions = this._sort(this.actions);
        }
        await this.store.put(normalized);
        if (emit) {
            this._broadcastChange();
            this.eventBus?.publish?.('HISTORY_OP_RECORDED', { entry: normalized });
        }
        return normalized;
    }

    // ─── Undo / Redo ───────────────────────────────────────────────────

    canUndo() {
        // Can undo if there exists at least one entry not currently 'undone'.
        return this.actions.some(entry => entry.status !== 'undone');
    }

    canRedo() {
        // Can redo if at least one entry is currently 'undone'.
        return this._undoDepth > 0;
    }

    undo({ steps = 1 } = {}) {
        if (!Number.isFinite(steps) || steps < 1) steps = 1;
        let lastEntry = null;
        for (let i = 0; i < steps; i += 1) {
            const entry = this._undoOne();
            if (!entry) break;
            lastEntry = entry;
        }
        if (lastEntry) {
            this._broadcastChange();
            this.eventBus?.publish?.('HISTORY_OP_UNDONE', {
                entry: { id: lastEntry.id, intent: lastEntry.intent },
                cursor: this.cursor
            });
        }
        return lastEntry;
    }

    redo({ steps = 1 } = {}) {
        if (!Number.isFinite(steps) || steps < 1) steps = 1;
        let lastEntry = null;
        for (let i = 0; i < steps; i += 1) {
            const entry = this._redoOne();
            if (!entry) break;
            lastEntry = entry;
        }
        if (lastEntry) {
            this._broadcastChange();
            this.eventBus?.publish?.('HISTORY_OP_REDONE', {
                entry: { id: lastEntry.id, intent: lastEntry.intent },
                cursor: this.cursor
            });
        }
        return lastEntry;
    }

    _undoOne() {
        // Walk from tip (index 0) to find the first non-'undone' entry.
        for (let i = 0; i < this.actions.length; i += 1) {
            const entry = this.actions[i];
            if (entry.status === 'undone') continue;
            entry.status = 'undone';
            entry.updatedAt = Date.now();
            this._undoDepth = i + 1;
            this._lastUndoId = entry.id;
            this._persistEntry(entry);
            return entry;
        }
        return null;
    }

    _redoOne() {
        // Walk from tip while entries are 'undone'; the last 'undone' in the
        // contiguous block at the tip is the one to redo.
        if (this._undoDepth === 0 || this.actions.length === 0) return null;
        const targetIndex = this._undoDepth - 1;
        const entry = this.actions[targetIndex];
        if (!entry || entry.status !== 'undone') return null;
        entry.status = 'redone';
        entry.updatedAt = Date.now();
        this._undoDepth = targetIndex;
        this._lastRedoId = entry.id;
        this._persistEntry(entry);
        return entry;
    }

    _resetUndoDepth() {
        this._undoDepth = 0;
    }

    _trimRedoFrontier() {
        // When a new entry is recorded, any 'undone' entries that were
        // candidates for redo become unreachable. Mark them as 'undone' (final)
        // by leaving them in place — they are no longer contiguous with the tip.
        // No state change needed: the contiguous 'undone' block at the tip is
        // governed by _undoDepth, which we reset to 0 on record().
    }

    // ─── Query ─────────────────────────────────────────────────────────

    getAll() {
        return [...this.actions];
    }

    /**
     * Returns entries recorded strictly after the given cursor.
     * Cursor may be an entry id or omitted (returns all).
     */
    getSince(cursor) {
        if (!cursor) return this.getAll();
        const cursorIndex = this.actions.findIndex(entry => entry.id === cursor);
        if (cursorIndex === -1) return [];
        // actions are newest-first; "since cursor" = entries newer than cursor
        // = entries at indices [0, cursorIndex).
        return this.actions.slice(0, cursorIndex);
    }

    getEntry(id) {
        return this.actions.find(entry => entry.id === id) || null;
    }

    hasEntry(id) {
        return this.actions.some(entry => entry.id === id);
    }

    /**
     * Updates an entry in place. Used by sync layers to mutate payload/meta before
     * retry, or by any consumer that needs to patch an entry without appending a
     * new op. Pure-history callers normally use record() + undo() instead.
     */
    updateEntry(id, patch = {}) {
        const entry = this.actions.find(item => item.id === id);
        if (!entry) return null;
        Object.assign(entry, patch, { updatedAt: Date.now() });
        if (patch.meta && typeof patch.meta === 'object') {
            entry.meta = { ...entry.meta, ...patch.meta };
        }
        this._persistEntry(entry);
        this._broadcastChange();
        return entry;
    }

    /**
     * Removes an entry from the log. Used by sync layers (e.g. optimistic-sync's
     * SyncStateTracker) when an entry is acknowledged and no longer needs to
     * be tracked locally. Pure-history callers normally do NOT call this —
     * undo() is the supported way to reverse an entry.
     */
    removeEntry(id) {
        const idx = this.actions.findIndex(entry => entry.id === id);
        if (idx === -1) return false;
        const [removed] = this.actions.splice(idx, 1);
        if (removed?.status === 'undone') {
            this._undoDepth = Math.max(0, this._undoDepth - 1);
        }
        this._deleteEntry(id);
        this._broadcastChange();
        return true;
    }

    clearAll() {
        this.actions = [];
        this._undoDepth = 0;
        this.ready.then(() => this.store.clear()).catch((error) => {
            console.warn('[History] Failed to clear store:', error);
        });
        this._broadcastChange();
    }

    /**
     * Cursor — monotonically advancing opaque string for incremental consumers.
     * Currently: id of the tip entry (newest). Returns empty string when log
     * is empty.
     */
    get cursor() {
        return this.actions[0]?.id || '';
    }

    get clock() {
        return this._clock;
    }

    // ─── Internal helpers ──────────────────────────────────────────────

    _handleBroadcast(message) {
        if (!message || message.type !== 'history-update') return;
        this._reloadFromStore('broadcast');
    }

    _reloadFromStore(source = 'reload') {
        return this.ready.then(async () => {
            this.actions = this._sort(await this.store.getAll());
            this._resetUndoDepth();
        }).catch((error) => {
            console.warn(`[History] reload (${source}) failed:`, error);
        });
    }

    refreshFromStore(source = 'manual-refresh') {
        return this._reloadFromStore(source);
    }

    _persistEntry(entry) {
        this.ready.then(() => this.store.put(entry)).catch((error) => {
            console.warn('[History] Failed to persist entry:', error);
        });
    }

    _deleteEntry(id) {
        this.ready.then(() => this.store.delete(id)).catch((error) => {
            console.warn('[History] Failed to delete entry:', error);
        });
    }

    _broadcastChange() {
        this.broadcastSync?.postMessage({ type: 'history-update', timestamp: Date.now() });
    }

    _createMeta({ channels, undo, reducer, actionCreator, crdt, actor } = {}) {
        this._clock = Math.max(this._clock + 1, Date.now());
        const meta = {
            clock: this._clock,
            channels: this._normalizeChannels(channels),
            conflicts: 0
        };
        if (reducer) {
            meta.reducer = String(reducer);
        }
        if (actionCreator) {
            meta.actionCreator = String(actionCreator);
        }
        if (actor) {
            meta.actor = String(actor);
        }
        if (undo && typeof undo === 'object' && typeof undo.intent === 'string') {
            meta.undo = {
                intent: undo.intent,
                payload: undo.payload
            };
        }
        if (crdt) {
            const sanitized = this._sanitizeCrdt(crdt, meta);
            if (sanitized) {
                if (!sanitized.reducer && meta.reducer) {
                    sanitized.reducer = meta.reducer;
                }
                if (!sanitized.actor && meta.actor) {
                    sanitized.actor = meta.actor;
                }
                if (!sanitized.timestamp) {
                    sanitized.timestamp = meta.clock;
                }
                meta.crdt = sanitized;
            }
        }
        return meta;
    }

    _normalizeChannels(channels) {
        if (Array.isArray(channels) && channels.length) {
            return Array.from(new Set(channels.map((channel) => String(channel)))).slice(0, 8);
        }
        return ['global'];
    }

    _sort(list = []) {
        return list
            .map(entry => this._normalizeEntry(entry))
            .sort((a, b) => b.createdAt - a.createdAt);
    }

    _normalizeEntry(entry = {}) {
        const normalized = {
            ...entry,
            id: entry.id || HistoryService._createId(),
            createdAt: entry.createdAt || Date.now(),
            updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
            status: entry.status || 'recorded',
            attempts: entry.attempts || 0,
            meta: {
                ...entry.meta,
                channels: Array.isArray(entry.meta?.channels) && entry.meta.channels.length > 0
                    ? Array.from(new Set(entry.meta.channels))
                    : ['global'],
                undo: entry.meta?.undo || null,
                reducer: entry.meta?.reducer ? String(entry.meta.reducer).slice(0, 160) : undefined,
                actionCreator: entry.meta?.actionCreator ? String(entry.meta.actionCreator).slice(0, 160) : undefined,
                actor: entry.meta?.actor ? String(entry.meta.actor).slice(0, 96) : undefined
            }
        };
        if (normalized.meta?.crdt) {
            const sanitized = this._sanitizeCrdt(normalized.meta.crdt, normalized.meta);
            if (sanitized) {
                normalized.meta.crdt = sanitized;
            } else {
                delete normalized.meta.crdt;
            }
        }
        return normalized;
    }

    _sanitizeCrdt(raw = {}, context = {}) {
        if (typeof raw !== 'object' || raw === null) return null;
        const type = String(raw.type || '').toLowerCase();
        if (!CRDT_TYPES.has(type)) return null;
        const key = raw.key ? String(raw.key).slice(0, 160) : null;
        if (!key) return null;
        const descriptor = { type, key };
        const reducer = raw.reducer || context.reducer;
        if (reducer) {
            descriptor.reducer = String(reducer).slice(0, 160);
        }
        const actor = raw.actor || context.actor;
        if (actor) {
            descriptor.actor = String(actor).slice(0, 96);
        }
        const timestamp = Number.isFinite(raw.timestamp)
            ? Number(raw.timestamp)
            : Number(context.clock ?? this._clock);
        if (Number.isFinite(timestamp)) {
            descriptor.timestamp = timestamp;
        }
        if (type === 'lww-register') {
            if (raw.value !== undefined) {
                descriptor.value = this._cloneValue(raw.value);
            }
            if (raw.field) {
                descriptor.field = String(raw.field).slice(0, 96);
            }
        } else {
            const delta = Number(raw.delta ?? 0);
            if (Number.isFinite(delta)) {
                descriptor.delta = delta;
            }
        }
        if (raw.metadata && typeof raw.metadata === 'object') {
            descriptor.metadata = raw.metadata;
        }
        return descriptor;
    }

    _cloneValue(value) {
        if (value === undefined) return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                // fall-through
            }
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return value;
        }
    }

    static _createId() {
        return uid('entry');
    }
}
