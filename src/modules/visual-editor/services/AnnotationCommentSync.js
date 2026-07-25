/**
 * AnnotationCommentSync — bridges AnnotationCommentService events to CRDT sync.
 *
 * Subscribes to local comment events and pushes them into ActionLogService as
 * CRDT intents. Also handles incoming sync intents from remote peers via the
 * EventBus SYNC_INTENT_APPLIED event.
 */
export class AnnotationCommentSync {
    constructor(eventBus, actionLogService, annotationCommentService) {
        this.eventBus = eventBus;
        this.actionLog = actionLogService;
        this.comments = annotationCommentService;
        this._unsubscribers = [];
        this.initialized = false;
    }

    init() {
        if (this.initialized) this.destroy();
        this.initialized = true;

        // Outgoing: listen for comment events, push to action log
        const events = [
            { event: 'ANNOTATION_COMMENT_ADDED', intent: 'ANNOTATION_COMMENT_ADD' },
            { event: 'ANNOTATION_COMMENT_RESOLVED', intent: 'ANNOTATION_COMMENT_RESOLVE' },
            { event: 'ANNOTATION_COMMENT_REOPENED', intent: 'ANNOTATION_COMMENT_REOPEN' },
            { event: 'ANNOTATION_COMMENT_UPDATED', intent: 'ANNOTATION_COMMENT_EDIT' }
        ];

        for (const { event, intent } of events) {
            const unsub = this.eventBus.subscribe(event, (payload) => {
                if (this.actionLog) {
                    this.actionLog.record(intent, payload);
                }
            });
            this._unsubscribers.push(unsub);
        }

        // Incoming: listen for applied intents from sync, apply locally
        if (this.eventBus) {
            const incomingUnsub = this.eventBus.subscribe('SYNC_INTENT_APPLIED', (ev) => {
                this._handleIncoming(ev);
            });
            this._unsubscribers.push(incomingUnsub);
        }
    }

    destroy() {
        this._unsubscribers.forEach(fn => { try { fn(); } catch {} });
        this._unsubscribers = [];
        this.initialized = false;
    }

    _handleIncoming(ev) {
        if (!ev || !ev.intent) return;
        const { intent, payload } = ev;

        switch (intent) {
            case 'ANNOTATION_COMMENT_ADD':
                // Apply remote comment add
                if (payload && payload.anchor && payload.payload) {
                    try {
                        this.comments.addComment(payload.anchor, payload.payload);
                    } catch (err) {
                        console.warn('[AnnotationCommentSync] Failed to apply remote add:', err.message);
                    }
                }
                break;
            case 'ANNOTATION_COMMENT_RESOLVE':
                if (payload && payload.commentId) {
                    try {
                        this.comments.resolveComment(payload.commentId);
                    } catch (err) {
                        console.warn('[AnnotationCommentSync] Failed to apply remote resolve:', err.message);
                    }
                }
                break;
            case 'ANNOTATION_COMMENT_REOPEN':
                if (payload && payload.commentId) {
                    try {
                        this.comments.reopenComment(payload.commentId);
                    } catch (err) {
                        console.warn('[AnnotationCommentSync] Failed to apply remote reopen:', err.message);
                    }
                }
                break;
            case 'ANNOTATION_COMMENT_EDIT':
                if (payload && payload.commentId && payload.payload && payload.payload.body) {
                    try {
                        this.comments.editComment(payload.commentId, payload.payload.body);
                    } catch (err) {
                        console.warn('[AnnotationCommentSync] Failed to apply remote edit:', err.message);
                    }
                }
                break;
        }
    }
}
