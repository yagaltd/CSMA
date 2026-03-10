import { AIService } from './services/AIService.js';

export const manifest = {
    id: 'ai',
    name: 'AI Module',
    version: '1.0.0',
    description: 'Multi-provider AI orchestration with fallback and tooling',
    dependencies: [],
    services: ['ai'],
    bundleSize: '+12KB',
    contracts: [
        'AI_PROVIDER_REGISTERED',
        'AI_PROVIDER_ERROR',
        'AI_GENERATE_STARTED',
        'AI_MESSAGE_STREAM',
        'AI_GENERATE_COMPLETE',
        'AI_GENERATE_ERROR',
        'AI_CHAT_CREATED',
        'AI_CHAT_RESET',
        'AI_MESSAGE_SENT',
        'AI_MESSAGE_RECEIVED',
        'AI_TOOL_CALLED',
        'AI_TOOL_RESULT',
        'AI_TOOL_ERROR',
        'AI_SECURITY_VIOLATION'
    ]
};

export const services = {
    ai: AIService
};

export function createAI(eventBus, options = {}) {
    const service = new AIService(eventBus, options);
    service.init(options);
    return service;
}
