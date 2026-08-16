import { object, string, optional } from '../../../runtime/validation/index.js';

export const WebmcpContracts = {
    INTENT_WEBMCP_EXPOSE_TOOLS: {
        version: 1,
        type: 'intent',
        owner: 'webmcp',
        lifecycle: 'active',
        stability: 'experimental',
        compliance: 'internal',
        description: 'Request exposure of selected intents as browser-agent tools (no-op without the WebMCP API)',
        schema: object({
            filter: optional(string()),
            reason: optional(string())
        }),
        security: {
            rateLimits: { requests: 10, windowMs: 60000, scope: 'session' }
        }
    },
    WEBMCP_TOOLS_REGISTERED: {
        version: 1,
        type: 'event',
        owner: 'webmcp',
        lifecycle: 'active',
        stability: 'experimental',
        compliance: 'internal',
        description: 'Published after tools are registered with the browser; reports the tool count',
        schema: object({
            count: string(),
            surface: string()
        })
    }
};
