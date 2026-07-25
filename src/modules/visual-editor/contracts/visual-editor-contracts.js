/**
 * Visual Editor EventBus Contracts
 *
 * Defines all intents (user/system requests) and events (state changes)
 * for the visual-editor module. Validated by CSMA EventBus.
 */

import { object, string, number, boolean, array, any, optional } from '../../../runtime/validation/index.js';

export const VisualEditorContracts = {
    // ===================================================================
    // Intents
    // ===================================================================

    /**
     * Initialize an editor session with schema + document.
     */
    INTENT_EDITOR_INIT: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: {
            rateLimits: { requests: 10, windowMs: 60000, scope: 'session' }
        },
        description: 'Initialize a visual editor session with schema and document',
        schema: object({
            editorId: string(),
            schema: object(),
            doc: object(),
            config: optional(object()),
            selection: optional(object())
        })
    },

    /**
     * Destroy an editor session.
     */
    INTENT_EDITOR_DESTROY: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: {
            rateLimits: { requests: 10, windowMs: 60000, scope: 'session' }
        },
        description: 'Destroy a visual editor session',
        schema: object({
            editorId: string()
        })
    },

    /**
     * Execute a named command on an editor session.
     */
    INTENT_EDITOR_COMMAND: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: {
            rateLimits: { requests: 60, windowMs: 60000, scope: 'session' }
        },
        description: 'Execute an editor command by name',
        schema: object({
            editorId: string(),
            command: string(),
            args: optional(array(any()))
        })
    },

    /**
     * Request current editor state.
     */
    INTENT_EDITOR_GET_STATE: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: {
            rateLimits: { requests: 60, windowMs: 60000, scope: 'session' }
        },
        description: 'Request current editor state',
        schema: object({
            editorId: string()
        })
    },

    // ===================================================================
    // Events
    // ===================================================================

    /**
     * Document content changed after transaction applied.
     */
    EDITOR_DOCUMENT_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Document content changed after transaction applied',
        schema: object({
            editorId: string(),
            documentId: string(),
            ops: array(any()),
            canUndo: boolean(),
            canRedo: boolean(),
            timestamp: number()
        })
    },

    /**
     * Editor selection changed.
     */
    EDITOR_SELECTION_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Editor selection changed',
        schema: object({
            editorId: string(),
            selection: optional(object()),
            availableMarkTypes: array(string()),
            availableAnnotationTypes: array(string()),
            activeMark: optional(string()),
            activeAnnotation: optional(string()),
            selectedNodeType: optional(string()),
            timestamp: number()
        })
    },

    /**
     * Editor session initialized and ready.
     */
    EDITOR_READY: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Editor session initialized and ready',
        schema: object({
            editorId: string(),
            documentId: string(),
            schemaNodeTypes: array(string()),
            timestamp: number()
        })
    },

    /**
     * Current editor state in response to INTENT_EDITOR_GET_STATE.
     */
    EDITOR_STATE: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Current editor state in response to INTENT_EDITOR_GET_STATE',
        schema: object({
            editorId: string(),
            doc: object(),
            selection: optional(object()),
            canUndo: boolean(),
            canRedo: boolean(),
            historyLength: number(),
            historyIndex: number(),
            timestamp: number()
        })
    },

    /**
     * Editor command execution error.
     */
    EDITOR_COMMAND_ERROR: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Editor command execution error',
        schema: object({
            editorId: string(),
            command: string(),
            error: string(),
            timestamp: number()
        })
    },

    /**
     * Editor operation error.
     */
    EDITOR_ERROR: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Editor operation error',
        schema: object({
            editorId: string(),
            error: string(),
            code: optional(string()),
            timestamp: number()
        })
    },

    // ===================================================================
    // Annotation Comment Intents
    // ===================================================================

    /**
     * Add an annotation comment.
     */
    INTENT_ANNOTATION_COMMENT_ADD: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 30, windowMs: 60000, scope: 'session' } },
        description: 'Add an annotation comment',
        schema: object({
            editorId: string(),
            anchor: object({
                type: string(),
                path: optional(array()),
                start_offset: optional(number()),
                end_offset: optional(number()),
                node_path: optional(array())
            }),
            payload: object({
                author: optional(object()),
                body: string(),
                assigned_to: optional(object()),
                thread_reply_to: optional(string())
            })
        })
    },

    /**
     * Resolve an annotation comment.
     */
    INTENT_ANNOTATION_COMMENT_RESOLVE: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 30, windowMs: 60000, scope: 'session' } },
        description: 'Resolve an annotation comment',
        schema: object({
            editorId: string(),
            commentId: string()
        })
    },

    /**
     * Reopen an annotation comment.
     */
    INTENT_ANNOTATION_COMMENT_REOPEN: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 30, windowMs: 60000, scope: 'session' } },
        description: 'Reopen an annotation comment',
        schema: object({
            editorId: string(),
            commentId: string()
        })
    },

    /**
     * Edit annotation comment body.
     */
    INTENT_ANNOTATION_COMMENT_EDIT: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 30, windowMs: 60000, scope: 'session' } },
        description: 'Edit annotation comment body',
        schema: object({
            editorId: string(),
            commentId: string(),
            body: string()
        })
    },

    /**
     * Reply to an annotation comment.
     */
    INTENT_ANNOTATION_COMMENT_REPLY: {
        version: 1,
        type: 'intent',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 30, windowMs: 60000, scope: 'session' } },
        description: 'Reply to an annotation comment',
        schema: object({
            editorId: string(),
            commentId: string(),
            body: string(),
            author: optional(object())
        })
    },

    // ===================================================================
    // Annotation Comment Events
    // ===================================================================

    /**
     * Annotation comment added.
     */
    ANNOTATION_COMMENT_ADDED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 120, windowMs: 60000, scope: 'session' } },
        description: 'Annotation comment added',
        schema: object({
            editorId: string(),
            commentId: string(),
            anchor: object(),
            payload: object(),
            timestamp: number()
        })
    },

    /**
     * Annotation comment updated.
     */
    ANNOTATION_COMMENT_UPDATED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 120, windowMs: 60000, scope: 'session' } },
        description: 'Annotation comment updated',
        schema: object({
            editorId: string(),
            commentId: string(),
            payload: object(),
            deleted: optional(boolean()),
            timestamp: number()
        })
    },

    /**
     * Annotation comment resolved.
     */
    ANNOTATION_COMMENT_RESOLVED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 120, windowMs: 60000, scope: 'session' } },
        description: 'Annotation comment resolved',
        schema: object({
            editorId: string(),
            commentId: string(),
            payload: object(),
            timestamp: number()
        })
    },

    /**
     * Annotation comment reopened.
     */
    ANNOTATION_COMMENT_REOPENED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 120, windowMs: 60000, scope: 'session' } },
        description: 'Annotation comment reopened',
        schema: object({
            editorId: string(),
            commentId: string(),
            payload: object(),
            timestamp: number()
        })
    },

    /**
     * Annotation comments bulk loaded.
     */
    ANNOTATION_COMMENTS_LOADED: {
        version: 1,
        type: 'event',
        owner: 'visual-editor',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        security: { rateLimits: { requests: 120, windowMs: 60000, scope: 'session' } },
        description: 'Annotation comments bulk loaded',
        schema: object({
            editorId: string(),
            comments: array(any()),
            timestamp: number()
        })
    },
};
