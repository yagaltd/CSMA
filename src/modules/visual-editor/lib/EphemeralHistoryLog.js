/**
 * EphemeralHistoryLog — in-memory-only undo/redo log for EditorSessionService.
 *
 * Vendored, trimmed variant of src/modules/history/services/HistoryService.js
 * (module-boundary rule: modules do not import modules). It implements the
 * exact surface EditorSessionService consumes — record / undo / redo /
 * canUndo / canRedo / getAll / updateEntry / cursor — with semantics copied
 * verbatim from HistoryService's method bodies, minus persistence
 * (store) and cross-tab broadcast: the ephemeral path historically ran
 * HistoryService with a noop store and init() deliberately not called, so
 * behavior is byte-equivalent (same events, same return shapes, same
 * newest-first ordering and undo-depth model).
 *
 * Delta from source: no init/ingest/getSince/getEntry/hasEntry/removeEntry/
 * clearAll, no HistoryStore, no BroadcastSync — none are reachable from
 * EditorSessionService. See src/modules/visual-editor/README.md.
 */

import { uid } from '../../../utils/id.js';

const CRDT_TYPES = new Set(['lww-register', 'g-counter', 'p-counter']);

export class EphemeralHistoryLog {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.actions = [];
        this._clock = Date.now();
        /**
         * Navigation cursor for undo/redo. The actions array is sorted
         * newest-first, so `_undoDepth` counts how many entries from the tip
         * are currently undone.
         */
        this._undoDepth = 0;
        this._lastUndoId = null;
        this._lastRedoId = null;
    }

    // ─── Append ────────────────────────────────────────────────────────

    record(intent, payload, options = {}) {
        const entry = this._normalizeEntry({
            id: EphemeralHistoryLog._createId(),
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
        // Newly recorded entry sits at the tip; reset redo frontier.
        this._trimRedoFrontier();
        this._undoDepth = 0;
        this.eventBus?.publish?.('HISTORY_OP_RECORDED', { entry });
        return entry;
    }

    // ─── Undo / Redo ───────────────────────────────────────────────────

    canUndo() {
        return this.actions.some(entry => entry.status !== 'undone');
    }

    canRedo() {
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
            this.eventBus?.publish?.('HISTORY_OP_REDONE', {
                entry: { id: lastEntry.id, intent: lastEntry.intent },
                cursor: this.cursor
            });
        }
        return lastEntry;
    }

    _undoOne() {
        for (let i = 0; i < this.actions.length; i += 1) {
            const entry = this.actions[i];
            if (entry.status === 'undone') continue;
            entry.status = 'undone';
            entry.updatedAt = Date.now();
            this._undoDepth = i + 1;
            this._lastUndoId = entry.id;
            return entry;
        }
        return null;
    }

    _redoOne() {
        if (this._undoDepth === 0 || this.actions.length === 0) return null;
        const targetIndex = this._undoDepth - 1;
        const entry = this.actions[targetIndex];
        if (!entry || entry.status !== 'undone') return null;
        entry.status = 'redone';
        entry.updatedAt = Date.now();
        this._undoDepth = targetIndex;
        this._lastRedoId = entry.id;
        return entry;
    }

    _resetUndoDepth() {
        this._undoDepth = 0;
    }

    _trimRedoFrontier() {
        // No state change needed: the contiguous 'undone' block at the tip is
        // governed by _undoDepth, which record() resets to 0.
    }

    // ─── Query ─────────────────────────────────────────────────────────

    getAll() {
        return [...this.actions];
    }

    updateEntry(id, patch = {}) {
        const entry = this.actions.find(item => item.id === id);
        if (!entry) return null;
        Object.assign(entry, patch, { updatedAt: Date.now() });
        if (patch.meta && typeof patch.meta === 'object') {
            entry.meta = { ...entry.meta, ...patch.meta };
        }
        return entry;
    }

    get cursor() {
        return this.actions[0]?.id || '';
    }

    get clock() {
        return this._clock;
    }

    // ─── Internal helpers (copied verbatim from HistoryService) ────────

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
            id: entry.id || EphemeralHistoryLog._createId(),
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
