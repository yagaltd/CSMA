export class CommentsService {
    constructor(eventBus) { this.eventBus = eventBus; this.comments = new Map(); this.pending = new Map(); this.endpoint = null; this.moderationEndpoint = null; this.fetcher = null; this.subscriptions = []; this.initialized = false; this.sequence = 0; }
    init(options = {}) { if (this.initialized) return; this.initialized = true; this.endpoint = options.endpoint || null; this.moderationEndpoint = options.moderationEndpoint || null; this.fetcher = options.fetcher || globalThis.fetch?.bind(globalThis); for (const comment of options.comments || []) this.put(comment); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_COMMENTS_LOAD', (p) => this.load(p.items || p.data || []))); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_COMMENT_SUBMIT', (p) => this.submit(p.item || p.data))); this.subscriptions.push(this.eventBus?.subscribe?.('INTENT_COMMENT_MODERATE', (p) => this.moderate(p.id, p.data || {}))); this.publish(); }
    destroy() { this.initialized = false; this.subscriptions.splice(0).forEach((u) => u?.()); }
    async loadRemote(threadId) { if (!this.endpoint || !this.fetcher) return this.getComments(threadId); const url = new URL(this.endpoint, globalThis.location?.origin || 'http://localhost'); if (threadId) url.searchParams.set('threadId', threadId); const response = await this.fetcher(url.toString(), { credentials: 'same-origin' }); if (!response.ok) throw new Error(`Comments load failed with ${response.status}`); const data = await response.json(); return this.load(Array.isArray(data) ? data : data.items || []); }
    load(comments = []) { this.comments.clear(); comments.forEach((comment) => this.put(comment)); this.publish(); return this.getComments(); }
    put(comment = {}) { const normalized = this.normalize(comment); this.comments.set(normalized.id, normalized); return normalized; }
    async submitRemote(comment = {}) { if (!this.endpoint || !this.fetcher) return this.submit(comment); const response = await this.fetcher(this.endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(comment) }); if (!response.ok) throw new Error(`Comment submit failed with ${response.status}`); const data = await response.json(); return this.submit(data.comment || data); }
    submit(comment = {}) { const normalized = this.normalize({ ...comment, id: comment.id || `optimistic-comment-${++this.sequence}`, status: comment.status || 'pending' }); this.pending.set(normalized.id, normalized); this.comments.set(normalized.id, normalized); this.eventBus?.publish?.('COMMENT_SUBMITTED', { id: normalized.id, item: normalized, timestamp: Date.now() }); this.publish(); return normalized; }
    async moderateRemote(id, patch = {}) { if (!this.moderationEndpoint || !this.fetcher) return this.moderate(id, patch); const response = await this.fetcher(`${this.moderationEndpoint}/${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); if (!response.ok) throw new Error(`Comment moderation failed with ${response.status}`); const data = await response.json(); return this.moderate(id, data.comment || data); }
    moderate(id, patch = {}) { if (!this.comments.has(String(id))) return null; const next = { ...this.comments.get(String(id)), ...patch, id: String(id) }; this.comments.set(String(id), next); this.publish(); return next; }
    normalize(comment) { return { id: String(comment.id || `comment-${++this.sequence}`), threadId: String(comment.threadId || ''), authorId: comment.authorId || '', body: comment.body || '', status: comment.status || 'published', labels: comment.labels || [], timestamp: comment.timestamp || Date.now(), data: comment.data || {} }; }
    getComments(threadId) { return [...this.comments.values()].filter((comment) => !threadId || comment.threadId === threadId); }
    publish() { this.eventBus?.publish?.('COMMENTS_UPDATED', { items: this.getComments(), data: { pending: this.pending.size }, timestamp: Date.now() }); }

    /**
     * Mount an aiui surface into a container element.
     *
     * Runtime contract for module aiui surfaces:
     *   mountSurface(surfaceId, container, props) → cleanupFn
     *
     * Supported surfaces:
     *   - 'comments-thread' — renders the comments for `props.threadId`, with
     *     optional `props.focusCommentId` highlighting.
     *
     * Returns a cleanup function that empties the container.
     */
    mountSurface(surfaceId, container, props = {}) {
        if (surfaceId !== 'comments-thread') {
            throw new Error(`CommentsService.mountSurface: unknown surface "${surfaceId}"`);
        }
        const doc = container.ownerDocument || globalThis.document;

        const renderThread = () => {
            container.replaceChildren();
            const thread = this.getComments(props.threadId || undefined);
            for (const comment of thread) {
                const item = doc.createElement('article');
                item.className = 'comments-thread__item';
                item.dataset.commentId = comment.id;
                item.dataset.status = comment.status || 'published';
                if (props.focusCommentId && comment.id === String(props.focusCommentId)) {
                    item.setAttribute('data-focused', '');
                }
                const body = doc.createElement('p');
                body.className = 'comments-thread__body';
                body.textContent = comment.body || '';
                item.append(body);
                container.append(item);
            }
        };

        renderThread();
        const off = this.eventBus?.subscribe?.('COMMENTS_UPDATED', renderThread);

        return () => {
            if (typeof off === 'function') off();
            container.replaceChildren();
        };
    }
}
