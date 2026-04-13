/**
 * Re-export shim for ai-ui module.
 * The runtime code moved to library/ui/ai-composer/.
 * This shim preserves backward compatibility for ModuleManager.loadModule('ai-ui').
 */
export { AIUIComposerService } from '../../ui/ai-composer/index.js';
export const manifest = {
    id: 'ai-ui',
    name: 'AI UI Composer',
    version: '1.0.0',
    description: 'Runtime AI-driven CSMA UI composition',
    dependencies: [],
    services: ['AIUIComposerService'],
    contracts: [],
    contributes: {
        commands: [],
        routes: [],
        views: []
    }
};
