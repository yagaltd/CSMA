/**
 * Register annotation comment CRDT intents with the CrdtReducerRegistry.
 * Call this once during visual-editor initialization.
 *
 * @param {import('../../optimistic-sync/services/CrdtReducerRegistry.js').CrdtReducerRegistry} registry
 */
export function registerAnnotationCommentCrdts(registry) {
    if (!registry) return;

    registry.registerIntent('ANNOTATION_COMMENT_ADD', {
        reducerId: 'annotation_comment_set',
        crdt: { type: 'lww-register' }
    });

    registry.registerIntent('ANNOTATION_COMMENT_RESOLVE', {
        reducerId: 'annotation_comment_status',
        crdt: { type: 'lww-register' }
    });

    registry.registerIntent('ANNOTATION_COMMENT_REOPEN', {
        reducerId: 'annotation_comment_status',
        crdt: { type: 'lww-register' }
    });

    registry.registerIntent('ANNOTATION_COMMENT_EDIT', {
        reducerId: 'annotation_comment_body',
        crdt: { type: 'lww-register' }
    });

    registry.registerIntent('ANNOTATION_COMMENT_REPLY', {
        reducerId: 'annotation_comment_reply',
        crdt: { type: 'lww-register' }
    });
}
