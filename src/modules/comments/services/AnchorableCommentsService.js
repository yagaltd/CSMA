/**
 * AnchorableCommentsService — Phase 4 Layer 0.
 *
 * EXTENDS CommentsService (subclass). The base class owns the flat comment
 * store (`this.comments` Map), the legacy `submit()` / `getComments(threadId)`
 * API, the `comments-thread` aiui surface, and `COMMENTS_UPDATED` fanout. This
 * subclass layers on:
 *
 *   - anchor fields on the comment payload (scope, anchor_type, anchor,
 *     parent_id, status lifecycle, resolved_at/by, edited_at, assigned_to)
 *   - anchor-aware CRUD: add({anchor, body, author?}), reply, resolve, reopen,
 *     edit, soft-delete
 *   - scope- and anchor-filtered queries + open-count aggregation (dock badge)
 *   - IDB persistence via the storage module, with optimistic in-memory
 *     mutations and a debounced (50ms) write-back. Falls back to in-memory only
 *     when no storage backend is available.
 *
 * Comment lifecycle (anchored comments):
 *   open → resolved → reopened → …      (status toggles)
 *   open → deleted                       (soft delete; record retained)
 *
 * No UI lives here. Drawer / popup / marker arrive in 4.1 / 4.2.
 */
import { CommentsService } from './CommentsService.js';
import { validateAnchorShape } from './AnchorResolver.js';

/**
 * IDB schema handed to the storage backend. The comments object store is keyed
 * by `id` with indexes covering the common query axes (scope, anchor_type,
 * status, parent_id).
 */
export const COMMENTS_SCHEMA = {
    comments: {
        keyPath: 'id',
        autoIncrement: false,
        indexes: { scope: 'scope', anchor_type: 'anchor_type', status: 'status', parent_id: 'parent_id' }
    }
};

const PERSIST_DEBOUNCE_MS = 50;

export class AnchorableCommentsService extends CommentsService {
    constructor(eventBus) {
        super(eventBus);
        this.serviceManager = null;
        this.storage = null;
        this.storeName = 'comments';
        this.persist = true;
        this._persistTimer = null;
        this._seq = 0;
    }

    /** Injected by ServiceManager.register so init() can resolve the storage service. */
    setServiceManager(sm) { this.serviceManager = sm; }

    async init(options = {}) {
        super.init(options);

        this.storage = options.storage ?? null;
        if (!this.storage && this.serviceManager) {
            this.storage = this.serviceManager.get?.('storage') || this.serviceManager.get?.('Storage') || null;
        }
        this.storeName = options.storeName || 'comments';
        this.persist = options.persist !== false;

        const sub = (name, handler) => {
            const unsub = this.eventBus?.subscribe?.(name, handler);
            if (typeof unsub === 'function') this.subscriptions.push(unsub);
        };
        sub('INTENT_COMMENT_ADD', (p) => this.add(p));
        sub('INTENT_COMMENT_REPLY', (p) => this.reply(p.parentId, p.body, { author: p.author, scope: p.scope }));
        sub('INTENT_COMMENT_RESOLVE', (p) => this.resolve(p.id, p.resolvedBy));
        sub('INTENT_COMMENT_REOPEN', (p) => this.reopen(p.id));
        sub('INTENT_COMMENT_EDIT', (p) => this.edit(p.id, p.body));
        sub('INTENT_COMMENT_DELETE', (p) => this.delete(p.id));
        sub('INTENT_COMMENTS_OPEN_DRAWER', (p) => this.openDrawer(p.scope));
        sub('INTENT_COMMENTS_CLOSE_DRAWER', () => this.closeDrawer());
        sub('INTENT_COMMENTS_FOCUS', (p) => this.focus(p.id));

        if (this.persist) {
            if (this.storage && typeof this.storage.init === 'function') {
                try {
                    await this.storage.init(options.schema || COMMENTS_SCHEMA);
                    await this._loadFromStore();
                } catch (err) {
                    this.persist = false;
                    console.warn('[comments] storage init failed; AnchorableCommentsService running in-memory only:', err?.message);
                }
            } else if (!this.storage) {
                this.persist = false;
                console.warn('[comments] storage module not available; AnchorableCommentsService running in-memory only');
            }
        }

        this._emitCount(null);
        return this;
    }

    destroy() {
        if (this._persistTimer) {
            clearTimeout(this._persistTimer);
            this._persistTimer = null;
        }
        super.destroy();
    }

    // ── payload normalization ───────────────────────────────────────────

    /** Extend the base shape with anchor / lifecycle fields (all default null). */
    normalize(comment = {}) {
        const base = super.normalize(comment);
        return {
            ...base,
            scope: comment.scope ?? null,
            anchor_type: comment.anchor_type ?? null,
            anchor: comment.anchor ?? null,
            parent_id: comment.parent_id ?? null,
            author: comment.author ?? null,
            created_at: comment.created_at ?? base.timestamp,
            edited_at: comment.edited_at ?? null,
            resolved_at: comment.resolved_at ?? null,
            resolved_by: comment.resolved_by ?? null,
            assigned_to: comment.assigned_to ?? null,
            status: comment.status ?? 'open',
            type: comment.type ?? 'user'
        };
    }

    _generateId() {
        this._seq += 1;
        const rnd = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `${Date.now()}-${this._seq}`;
        return `cmt-${rnd}`;
    }

    // ── anchor-aware CRUD ───────────────────────────────────────────────

    /** Create an anchored (root) comment. Throws on an invalid anchor shape. */
    add({ scope, anchor, body, author, type, status, data } = {}) {
        if (typeof body !== 'string' || body.length === 0) {
            throw new Error('AnchorableCommentsService.add: body is required');
        }
        validateAnchorShape(anchor);
        const now = Date.now();
        const comment = this.normalize({
            id: this._generateId(),
            scope: scope ?? null,
            anchor_type: anchor.anchor_type,
            anchor: anchor.anchor,
            parent_id: null,
            body,
            author: author ?? null,
            status: status ?? 'open',
            type: type ?? 'user',
            data: data ?? {},
            created_at: now
        });
        this.comments.set(comment.id, comment);
        this._schedulePersist();
        this.publish();
        this._emit('COMMENT_ADDED', { comment, timestamp: now });
        this._emitCount(comment.scope);
        return comment;
    }

    /** Append a flat (one-level) reply; inherits the parent's scope + anchor. */
    reply(parentId, body, options = {}) {
        const parent = this.comments.get(String(parentId));
        if (!parent) {
            throw new Error(`AnchorableCommentsService.reply: parent "${parentId}" not found`);
        }
        if (typeof body !== 'string' || body.length === 0) {
            throw new Error('AnchorableCommentsService.reply: body is required');
        }
        const now = Date.now();
        const comment = this.normalize({
            id: this._generateId(),
            scope: parent.scope,
            anchor_type: parent.anchor_type,
            anchor: parent.anchor,
            parent_id: parent.id,
            body,
            author: options.author ?? null,
            status: options.status ?? 'open',
            type: options.type ?? 'user',
            data: options.data ?? {},
            created_at: now
        });
        this.comments.set(comment.id, comment);
        this._schedulePersist();
        this.publish();
        this._emit('COMMENT_ADDED', { comment, timestamp: now });
        this._emitCount(comment.scope);
        return comment;
    }

    resolve(id, resolvedBy = null) {
        const c = this.comments.get(String(id));
        if (!c) return null;
        const now = Date.now();
        const next = { ...c, status: 'resolved', resolved_at: now, resolved_by: resolvedBy };
        this.comments.set(c.id, next);
        this._schedulePersist();
        this.publish();
        this._emit('COMMENT_RESOLVED', { id: c.id, resolvedBy, resolvedAt: now, timestamp: now });
        this._emitCount(c.scope);
        return next;
    }

    reopen(id) {
        const c = this.comments.get(String(id));
        if (!c) return null;
        const now = Date.now();
        const next = { ...c, status: 'reopened', resolved_at: null, resolved_by: null };
        this.comments.set(c.id, next);
        this._schedulePersist();
        this.publish();
        this._emit('COMMENT_REOPENED', { id: c.id, timestamp: now });
        this._emitCount(c.scope);
        return next;
    }

    edit(id, body) {
        const c = this.comments.get(String(id));
        if (!c) return null;
        if (typeof body !== 'string' || body.length === 0) {
            throw new Error('AnchorableCommentsService.edit: body is required');
        }
        const now = Date.now();
        const changes = { body, edited_at: now };
        const next = { ...c, ...changes };
        this.comments.set(c.id, next);
        this._schedulePersist();
        this.publish();
        this._emit('COMMENT_UPDATED', { id: c.id, changes, timestamp: now });
        return next;
    }

    /** Soft-delete: retained for audit (status: 'deleted'). */
    delete(id) {
        const c = this.comments.get(String(id));
        if (!c) return null;
        const now = Date.now();
        const next = { ...c, status: 'deleted' };
        this.comments.set(c.id, next);
        this._schedulePersist();
        this.publish();
        this._emit('COMMENT_REMOVED', { id: c.id, timestamp: now });
        this._emitCount(c.scope);
        return next;
    }

    // ── drawer intents (no UI in 4.0 — these only emit state events) ────

    openDrawer(scope) {
        this._emit('COMMENTS_DRAWER_OPENED', { scope, timestamp: Date.now() });
    }

    closeDrawer() {
        this._emit('COMMENTS_DRAWER_CLOSED', { timestamp: Date.now() });
    }

    focus(id) {
        return this.comments.get(String(id)) || null;
    }

    // ── queries ─────────────────────────────────────────────────────────

    getByAnchor(anchor) {
        if (!anchor) return [];
        const { anchor_type, anchor: inner } = anchor;
        return [...this.comments.values()].filter((c) => c.anchor_type === anchor_type && this._anchorEquals(c.anchor, inner));
    }

    getByScope(scope) {
        return [...this.comments.values()].filter((c) => c.scope === scope);
    }

    /** Open = status 'open' or 'reopened'. Optional scope filter. */
    countOpen(scope) {
        let count = 0;
        for (const c of this.comments.values()) {
            if (!this._isOpen(c)) continue;
            if (scope !== undefined && c.scope !== scope) continue;
            count += 1;
        }
        return count;
    }

    // ── persistence ─────────────────────────────────────────────────────

    _schedulePersist() {
        if (!this.persist || !this.storage) return;
        if (this._persistTimer) clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => {
            this._persistTimer = null;
            this._flushPersist();
        }, PERSIST_DEBOUNCE_MS);
    }

    async _flushPersist() {
        if (!this.persist || !this.storage) return;
        try {
            for (const c of this.comments.values()) {
                await this.storage.update(this.storeName, c);
            }
        } catch (err) {
            console.warn('[comments] persist write failed:', err?.message);
        }
    }

    async _loadFromStore() {
        if (!this.persist || !this.storage) return;
        try {
            const items = await this.storage.getAll(this.storeName);
            if (Array.isArray(items)) {
                this.comments.clear();
                for (const it of items) {
                    const normalized = this.normalize(it);
                    this.comments.set(normalized.id, normalized);
                }
                this.publish();
            }
        } catch (err) {
            console.warn('[comments] load from storage failed:', err?.message);
        }
    }

    // ── helpers ─────────────────────────────────────────────────────────

    _isOpen(c) { return c.status === 'open' || c.status === 'reopened'; }

    _totalCount(scope) {
        if (scope === undefined || scope === null) return this.comments.size;
        return this.getByScope(scope).length;
    }

    _emitCount(scope) {
        const openCount = scope === null ? this.countOpen() : this.countOpen(scope);
        const totalCount = scope === null ? this.comments.size : this._totalCount(scope);
        this._emit('COMMENT_COUNT_CHANGED', { scope, openCount, totalCount, timestamp: Date.now() });
    }

    _anchorEquals(a, b) {
        if (a === b) return true;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        return ka.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
    }

    /**
     * Publish a validated event. Prefers publishSync (immediate dispatch, so
     * callers/tests can assert synchronously) and falls back to async publish.
     */
    _emit(name, payload) {
        if (typeof this.eventBus?.publishSync === 'function') {
            this.eventBus.publishSync(name, payload);
        } else {
            this.eventBus?.publish?.(name, payload);
        }
    }
}
