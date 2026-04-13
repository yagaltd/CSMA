const DEFAULT_STORAGE_KEY = 'csma.optimistic.actions';
const DB_NAME = 'csma-optimistic';
const STORE_NAME = 'actions';
const CRDT_TYPES = new Set(['lww-register', 'g-counter', 'pn-counter']);

export class ActionLogService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.storageKey = DEFAULT_STORAGE_KEY;
        this.windowRef = typeof window !== 'undefined' ? window : null;
        this.actions = [];
        this.clock = Date.now();
        this.ready = Promise.resolve();
        this.store = null;
        this.broadcastChannel = null;

        this.handleStorageEvent = this.handleStorageEvent.bind(this);
        this.handleBroadcast = this.handleBroadcast.bind(this);
    }

    async init(options = {}) {
        this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
        this.windowRef = options.window || this.windowRef;
        this.store = options.store || this._createStore();
        this.ready = this.store.init();
        await this.ready;
        this.actions = this._sort(await this.store.getAll());

        if (this.windowRef?.addEventListener && this.store.supportsStorageEvents) {
            this.windowRef.addEventListener('storage', this.handleStorageEvent);
        }

        if (typeof BroadcastChannel !== 'undefined') {
            this.broadcastChannel = new BroadcastChannel('csma-optimistic');
            this.broadcastChannel.addEventListener('message', this.handleBroadcast);
        }

        this.eventBus?.publish('OPTIMISTIC_LOG_READY', {
            count: this.actions.length,
            storageKey: this.storageKey
        });
    }

    destroy() {
        if (this.windowRef?.removeEventListener && this.store.supportsStorageEvents) {
            this.windowRef.removeEventListener('storage', this.handleStorageEvent);
        }
        if (this.broadcastChannel) {
            this.broadcastChannel.removeEventListener('message', this.handleBroadcast);
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
    }

    record(intent, payload, options = {}) {
        const entry = this._normalizeEntry({
            id: ActionLogService._createId(),
            intent,
            payload,
            status: 'pending',
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
        this.actions.push(entry);
        this.actions = this._sort(this.actions);
        this._persistEntry(entry);
        this._broadcastChange();
        this.eventBus?.publish('OPTIMISTIC_ACTION_RECORDED', { entry });
        return entry;
    }

    addReason(id, reason) {
        const entry = this.actions.find(item => item.id === id);
        if (!entry) return false;
        entry.meta.reasons = entry.meta.reasons || [];
        if (!entry.meta.reasons.includes(reason)) {
            entry.meta.reasons.push(reason);
            entry.updatedAt = Date.now();
            this._persistEntry(entry);
            this._broadcastChange();
            return true;
        }
        return false;
    }

    removeReason(id, reason) {
        const entry = this.actions.find(item => item.id === id);
        if (!entry || !Array.isArray(entry.meta?.reasons)) return false;
        const before = entry.meta.reasons.length;
        entry.meta.reasons = entry.meta.reasons.filter(item => item !== reason);
        if (entry.meta.reasons.length !== before) {
            entry.updatedAt = Date.now();
            this._persistEntry(entry);
            this._broadcastChange();
            return true;
        }
        return false;
    }

    markAcked(id) {
        const idx = this.actions.findIndex(action => action.id === id);
        if (idx === -1) return;
        const [entry] = this.actions.splice(idx, 1);
        this._deleteEntry(id);
        this._broadcastChange();
        this.eventBus?.publish('OPTIMISTIC_ACTION_ACKED', { entry });
    }

    markFailed(id, error, { terminal = false } = {}) {
        const action = this.actions.find(item => item.id === id);
        if (!action) return;
        action.attempts += 1;
        action.updatedAt = Date.now();
        action.lastError = error ? String(error) : undefined;
        action.status = terminal ? 'failed' : 'pending';
        this._persistEntry(action);
        if (terminal) {
            this._broadcastChange();
        }
        this.eventBus?.publish('OPTIMISTIC_ACTION_FAILED', {
            entry: action,
            terminal,
            error: action.lastError
        });
    }

    updatePayload(id, payload) {
        const action = this.actions.find(item => item.id === id);
        if (!action) return;
        action.payload = payload;
        action.updatedAt = Date.now();
        this._persistEntry(action);
        this._broadcastChange();
    }

    getPending() {
        return this.actions.filter(entry => entry.status === 'pending');
    }

    getAll() {
        return [...this.actions];
    }

    getEntry(id) {
        return this.actions.find(entry => entry.id === id) || null;
    }

    hasEntry(id) {
        return this.actions.some(entry => entry.id === id);
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
        }
        this.actions = this._sort(this.actions);
        await this.store.put(normalized);
        if (emit) {
            this._broadcastChange();
            this.eventBus?.publish('OPTIMISTIC_ACTION_INGESTED', { entry: normalized });
        }
        return normalized;
    }

    clearAll() {
        this.actions = [];
        this.ready.then(() => this.store.clear());
        this._broadcastChange();
    }

    handleStorageEvent(event) {
        if (event.key !== this.storageKey || !event.newValue) return;
        this.actions = this._sort(JSON.parse(event.newValue) || []);
        this.eventBus?.publish('OPTIMISTIC_LOG_UPDATED', {
            count: this.actions.length,
            source: 'storage-event'
        });
    }

    handleBroadcast(event) {
        if (event?.data?.type !== 'optimistic-sync-update') return;
        this._reloadFromStore('broadcast');
    }

    _reloadFromStore(source = 'reload') {
        return this.ready.then(async () => {
            this.actions = this._sort(await this.store.getAll());
            this.eventBus?.publish('OPTIMISTIC_LOG_UPDATED', {
                count: this.actions.length,
                source
            });
        });
    }

    refreshFromStore(source = 'manual-refresh') {
        return this._reloadFromStore(source);
    }

    _persistEntry(entry) {
        this.ready.then(() => this.store.put(entry)).catch((error) => {
            console.warn('[ActionLog] Failed to persist entry:', error);
        });
    }

    _deleteEntry(id) {
        this.ready.then(() => this.store.delete(id)).catch((error) => {
            console.warn('[ActionLog] Failed to delete entry:', error);
        });
    }

    _broadcastChange() {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({ type: 'optimistic-sync-update', timestamp: Date.now() });
        }
    }

    _createMeta({ channels, undo, reducer, actionCreator, crdt, actor } = {}) {
        this.clock = Math.max(this.clock + 1, Date.now());
        const meta = {
            clock: this.clock,
            reasons: ['pending'],
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
            id: entry.id || ActionLogService._createId(),
            createdAt: entry.createdAt || Date.now(),
            updatedAt: entry.updatedAt || entry.createdAt || Date.now(),
            status: entry.status || 'pending',
            attempts: entry.attempts || 0,
            meta: {
                ...entry.meta,
                reasons: Array.isArray(entry.meta?.reasons) && entry.meta.reasons.length > 0
                    ? Array.from(new Set(entry.meta.reasons))
                    : ['pending'],
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
            : Number(context.clock);
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

    _createStore() {
        if (typeof indexedDB !== 'undefined') {
            return new IndexedDbActionStore({ dbName: DB_NAME, storeName: STORE_NAME });
        }
        if (typeof localStorage !== 'undefined') {
            return new LocalStorageActionStore({ storageKey: this.storageKey });
        }
        return new MemoryActionStore();
    }

    static _createId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `action-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}

class IndexedDbActionStore {
    constructor({ dbName, storeName }) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
        this.supportsStorageEvents = false;
    }

    init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }

    getAll() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readonly');
            const store = tx.objectStore(this.storeName);
            const request = store.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result || [];
                result.sort((a, b) => b.createdAt - a.createdAt);
                resolve(result);
            };
        });
    }

    put(entry) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.put(entry);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    delete(id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.delete(id);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    clear() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, 'readwrite');
            const store = tx.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}

class LocalStorageActionStore {
    constructor({ storageKey }) {
        this.storageKey = storageKey;
        this.supportsStorageEvents = true;
    }

    init() {
        return Promise.resolve();
    }

    async getAll() {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return [];
        try {
            return JSON.parse(raw);
        } catch (error) {
            console.warn('[ActionLog] Failed to parse localStorage log:', error);
            return [];
        }
    }

    async put(entry) {
        const items = await this.getAll();
        const idx = items.findIndex(item => item.id === entry.id);
        if (idx > -1) {
            items[idx] = entry;
        } else {
            items.push(entry);
        }
        localStorage.setItem(this.storageKey, JSON.stringify(items));
    }

    async delete(id) {
        const items = await this.getAll();
        const filtered = items.filter(item => item.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    }

    async clear() {
        localStorage.removeItem(this.storageKey);
    }
}

class MemoryActionStore {
    constructor() {
        this.items = new Map();
        this.supportsStorageEvents = false;
    }

    init() {
        return Promise.resolve();
    }

    async getAll() {
        return Array.from(this.items.values());
    }

    async put(entry) {
        this.items.set(entry.id, entry);
    }

    async delete(id) {
        this.items.delete(id);
    }

    async clear() {
        this.items.clear();
    }
}
