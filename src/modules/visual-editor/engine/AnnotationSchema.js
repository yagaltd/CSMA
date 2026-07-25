/**
 * Schema definition for the annotation_comment node type.
 *
 * Consumers include this in their defineDocumentSchema() call alongside
 * their own document and block schemas.
 *
 * @example
 * import { defineDocumentSchema } from './DocumentSchema.js';
 * import { ANNOTATION_COMMENT_SCHEMA } from './AnnotationSchema.js';
 *
 * const mySchema = defineDocumentSchema({
 *     ...myDocAndBlockSchemas,
 *     ...ANNOTATION_COMMENT_SCHEMA
 * });
 */
export const ANNOTATION_COMMENT_SCHEMA = {
    annotation_comment: {
        kind: 'annotation',
        properties: {
            anchor_type: { type: 'string', default: 'text' },
            anchor_path: { type: 'array', nullable: true, default: null },
            payload: {
                type: 'object',
                default: {},
                properties: {
                    author: { type: 'object' },
                    body: { type: 'string', default: '' },
                    created_at: { type: 'number' },
                    edited_at: { type: 'number', nullable: true, default: null },
                    status: { type: 'string', default: 'open' },
                    resolved_at: { type: 'number', nullable: true, default: null },
                    resolved_by: { type: 'object', nullable: true, default: null },
                    assigned_to: { type: 'object', nullable: true, default: null },
                    thread_reply_to: { type: 'string', nullable: true, default: null }
                }
            }
        }
    }
};
