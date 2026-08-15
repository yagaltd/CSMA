import { EditorSessionService } from './services/EditorSessionService.js';
import { VisualEditorContracts } from './contracts/visual-editor-contracts.js';
import { AnnotationCommentService } from './services/AnnotationCommentService.js';
import { AnnotationCommentSync } from './services/AnnotationCommentSync.js';
import { registerAnnotationCommentCrdts } from './services/AnnotationCommentCrdt.js';

export const manifest = {
    id: 'visual-editor',
    name: 'Visual Editor',
    version: '1.0.0',
    description: 'Structured content editor with typed nodes, transactions, and undo/redo',
    dependencies: [],
    services: ['editorSession', 'annotationComment'],
    contracts: Object.keys(VisualEditorContracts),
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: ['editorContent'],
        views: []
    }
};

export const services = { editorSession: EditorSessionService, annotationComment: AnnotationCommentService };
export const contracts = VisualEditorContracts;

export { EditorSessionService };
export { AnnotationCommentService };
export { AnnotationCommentSync };
export { registerAnnotationCommentCrdts };
export { VisualEditorContracts };

// Re-export engine for direct use
export { defineDocumentSchema, validateDocumentSchema } from './engine/DocumentSchema.js';
export { createDocument, validateDocument, docGet, docInspect } from './engine/DocumentModel.js';
export { fillNodeDefaults, fillDocumentDefaults, getPropertyDefault } from './engine/DocumentDefaults.js';
export { validateNode, isIdValid, validateConfigComponents } from './engine/NodeValidator.js';
// Re-export annotation operations and schemas
export { addAnnotation, removeAnnotation, addNodeAnnotation, addDocumentAnnotation } from './engine/AnnotationOps.js';
export { ANNOTATION_COMMENT_SCHEMA } from './engine/AnnotationSchema.js';

export { SELECTION_TYPES, validateSelection, getSelectionRange, isSelectionCollapsed } from './engine/SelectionModel.js';

// Re-export rendering components for consumers
export { initEditorSurface } from './rendering/EditorSurface.js';
export { NodeRendererRegistry } from './rendering/NodeRenderer.js';
export { initTextPropertyEditor } from './rendering/TextPropertyEditor.js';
export { initNodeArrayContainer } from './rendering/NodeArrayContainer.js';
export { initSelectionOverlay } from './rendering/SelectionOverlay.js';
export { createNodeGapInserter } from './rendering/NodeGapInserter.js';
export { initEditorToolbar } from './ui/EditorToolbar.js';
export { initCommentSidebar } from './ui/CommentSidebar.js';
export { createInlineTextEditor } from './ui/InlineTextEditor.js';

export { initAnnotationHighlights } from './rendering/AnnotationHighlights.js';
export { KeyMapper, defineDefaultKeymap } from './input/KeyMapper.js';

// Re-export adapter
export { EditorContentAdapter } from './adapters/EditorContentAdapter.js';
