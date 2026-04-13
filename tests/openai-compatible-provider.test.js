import { describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from '../library/modules/ai/providers/OpenAICompatibleProvider.js';

function createSSEStream(chunks) {
    return new ReadableStream({
        start(controller) {
            chunks.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk)));
            controller.close();
        }
    });
}

describe('OpenAICompatibleProvider', () => {
    it('parses SSE chat completion streams and forwards raw chunk data', async () => {
        const fetchMock = vi.fn(async () => new Response(
            createSSEStream([
                'data: {"choices":[{"delta":{"content":"surface theme=\\"girly\\"\\n"}}]}\n\n',
                'data: {"choices":[{"delta":{"content":"  hero title=\\"Choose Your Plan\\" text=\\"Render through CSMA DSL.\\"\\n"}}]}\n\n',
                'data: {"choices":[{"delta":{"content":"  card title=\\"Start\\" text=\\"Approved components only.\\""}}]}\n\n',
                'data: [DONE]\n\n'
            ]),
            {
                status: 200,
                headers: {
                    'content-type': 'text/event-stream'
                }
            }
        ));

        const provider = new OpenAICompatibleProvider({
            baseUrl: 'https://example.test/v1',
            apiKey: 'test-key',
            model: 'demo-model',
            fetch: fetchMock
        });

        const streamChunks = [];
        const result = await provider.generateText({
            prompt: 'Render pricing cards',
            stream: true,
            onStream: (chunk) => streamChunks.push(chunk)
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.text).toContain('surface theme="girly"');
        expect(result.text).toContain('hero title="Choose Your Plan"');
        expect(streamChunks.length).toBeGreaterThan(0);
        expect(streamChunks[0].raw).toContain('"choices"');
    });
});
