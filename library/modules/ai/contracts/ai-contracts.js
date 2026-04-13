import { object, string, number, optional, any, array, enums, boolean } from '../../../runtime/validation/index.js';

export const AIContracts = {
    AI_PROVIDER_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when an AI provider is registered with the AI module',

        schema: object({
            name: string(),
            capabilities: any(),
            priority: number(),
            timestamp: number()
        })
    },

    AI_PROVIDER_ERROR: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when an AI provider operation fails',

        schema: object({
            requestId: optional(string()),
            provider: string(),
            capability: optional(string()),
            error: string(),
            timestamp: number()
        })
    },

    AI_GENERATE_STARTED: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Generation request accepted by selected provider',

        schema: object({
            requestId: string(),
            provider: string(),
            promptLength: number(),
            estimatedTokens: number(),
            timestamp: number()
        })
    },

    AI_MESSAGE_STREAM: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Streaming chunk emitted by provider',

        schema: object({
            requestId: string(),
            provider: string(),
            chunk: string(),
            timestamp: number()
        })
    },

    AI_GENERATE_COMPLETE: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Generation completed successfully',

        schema: object({
            requestId: string(),
            provider: string(),
            tokensUsed: number(),
            cost: number(),
            duration: number(),
            fallback: boolean(),
            timestamp: number()
        })
    },

    AI_GENERATE_ERROR: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Generation failed after retries',

        schema: object({
            requestId: string(),
            provider: string(),
            error: string(),
            timestamp: number()
        })
    },

    AI_CHAT_CREATED: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Chat session initialized',

        schema: object({
            chatId: string(),
            provider: string(),
            systemPrompt: string(),
            metadata: optional(any()),
            timestamp: number()
        })
    },

    AI_CHAT_RESET: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Chat history cleared',

        schema: object({
            chatId: string(),
            timestamp: number()
        })
    },

    AI_MESSAGE_SENT: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User message sent to AI chat',

        schema: object({
            chatId: string(),
            role: string(),
            message: string(),
            timestamp: number()
        })
    },

    AI_MESSAGE_RECEIVED: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Assistant reply added to chat history',

        schema: object({
            chatId: string(),
            role: string(),
            message: string(),
            timestamp: number()
        })
    },

    AI_TOOL_CALLED: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'An AI tool/function was invoked',

        schema: object({
            requestId: string(),
            tool: string(),
            parameters: any(),
            timestamp: number()
        })
    },

    AI_TOOL_RESULT: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tool execution completed',

        schema: object({
            requestId: string(),
            tool: string(),
            result: any(),
            duration: number(),
            timestamp: number()
        })
    },

    AI_TOOL_ERROR: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Tool execution failed',

        schema: object({
            requestId: string(),
            tool: string(),
            error: string(),
            timestamp: number()
        })
    },

    AI_SECURITY_VIOLATION: {
        version: 1,
        type: 'event',
        owner: 'ai-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'confidential',
        description: 'Published when AI security layer detects an issue',

        schema: object({
            requestId: optional(string()),
            layer: optional(number()),
            reason: string(),
            sanitized: optional(boolean()),
            timestamp: number()
        })
    }
};
