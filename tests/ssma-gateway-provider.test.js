import { describe, expect, it, vi } from 'vitest';
import { SSMAGatewayProvider } from '../src/modules/ai/providers/SSMAGatewayProvider.js';

function createJsonResponse(payload) {
    return {
        ok: true,
        headers: {
            get: () => 'application/json'
        },
        json: async () => payload
    };
}

function createStreamResponse(chunks, contentType = 'text/event-stream') {
    const encoder = new TextEncoder();
    return {
        ok: true,
        headers: {
            get: () => contentType
        },
        body: new ReadableStream({
            start(controller) {
                chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
                controller.close();
            }
        })
    };
}

describe('SSMAGatewayProvider', () => {
    it('uses the SSMA query boundary by default', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(createJsonResponse({
            status: 'ok',
            data: {
                text: 'hello from ssma',
                tokensUsed: 12,
                cost: 0
            }
        }));
        const provider = new SSMAGatewayProvider({ fetch: fetchImpl });

        const result = await provider.generateText({
            prompt: 'hello',
            system: 'be concise',
            maxTokens: 64,
            temperature: 0.2
        });

        expect(fetchImpl).toHaveBeenCalledWith('/query/ai.generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                payload: {
                    system: 'be concise',
                    prompt: 'hello',
                    messages: undefined,
                    maxTokens: 64,
                    temperature: 0.2,
                    stream: false
                }
            })
        });
        expect(result.text).toBe('hello from ssma');
        expect(result.tokensUsed).toBe(12);
    });

    it('supports explicit endpoint overrides for non-SSMA backends', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(createJsonResponse({
            text: 'custom endpoint'
        }));
        const provider = new SSMAGatewayProvider({
            fetch: fetchImpl,
            endpoint: '/custom/ai'
        });

        await provider.generateText({ prompt: 'hello' });

        expect(fetchImpl).toHaveBeenCalledWith('/custom/ai', expect.any(Object));
    });

    it('uses SSMA stream route for streaming and parses delta frames', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(createStreamResponse([
            'data: {"type":"chunk","delta":"Hello"}\n\n',
            'data: {"type":"chunk","delta":" world"}\n\n',
            'data: {"type":"done"}\n\n'
        ]));
        const onStream = vi.fn();
        const provider = new SSMAGatewayProvider({ fetch: fetchImpl });

        const result = await provider.generateText({
            prompt: 'hello',
            stream: true,
            onStream
        });

        expect(fetchImpl).toHaveBeenCalledWith('/query/ai.generate/stream', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                payload: {
                    system: undefined,
                    prompt: 'hello',
                    messages: undefined,
                    maxTokens: undefined,
                    temperature: undefined,
                    stream: true
                }
            })
        });
        expect(result.text).toBe('Hello world');
        expect(onStream).toHaveBeenNthCalledWith(1, {
            text: 'Hello',
            done: false,
            meta: { type: 'chunk', delta: 'Hello' }
        });
        expect(onStream).toHaveBeenNthCalledWith(2, {
            text: ' world',
            done: false,
            meta: { type: 'chunk', delta: ' world' }
        });
    });
});
