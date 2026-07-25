import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MentionParser } from '../src/modules/mentions/services/MentionParser.js';
import { MentionResolver } from '../src/modules/mentions/services/MentionResolver.js';
import { MentionBridge } from '../src/modules/mentions/services/MentionBridge.js';

// ---------------------------------------------------------------------------
// MentionParser
// ---------------------------------------------------------------------------
describe('MentionParser', () => {
    let parser;

    beforeEach(() => {
        parser = new MentionParser();
    });

    it('parses @ai mention', () => {
        const result = parser.parse('Fix this @ai please');
        expect(result).toEqual([{
            type: 'ai',
            id: null,
            raw: '@ai',
            start: 9,
            end: 12
        }]);
    });

    it('parses @user:bob mention with id', () => {
        const result = parser.parse('Ping @user:bob about this');
        expect(result).toEqual([{
            type: 'user',
            id: 'bob',
            raw: '@user:bob',
            start: 5,
            end: 14
        }]);
    });

    it('parses @group:design mention with id', () => {
        const result = parser.parse('Check with @group:design team');
        expect(result).toEqual([{
            type: 'group',
            id: 'design',
            raw: '@group:design',
            start: 11,
            end: 24
        }]);
    });

    it('parses multiple mentions in mixed text', () => {
        const result = parser.parse(
            '@ai explain this, and @user:alice please review'
        );
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            type: 'ai', id: null, raw: '@ai', start: 0, end: 3
        });
        expect(result[1]).toEqual({
            type: 'user', id: 'alice', raw: '@user:alice', start: 22, end: 33
        });
    });

    it('returns empty array for text with no mentions', () => {
        expect(parser.parse('Just plain text here')).toEqual([]);
    });

    it('returns empty array for empty string', () => {
        expect(parser.parse('')).toEqual([]);
    });

    it('returns empty array for non-string input', () => {
        expect(parser.parse(null)).toEqual([]);
        expect(parser.parse(undefined)).toEqual([]);
        expect(parser.parse(42)).toEqual([]);
    });

    it('parses @ai:task-001 with dotted id', () => {
        const result = parser.parse('Run @ai:task-001 please');
        expect(result).toEqual([{
            type: 'ai',
            id: 'task-001',
            raw: '@ai:task-001',
            start: 4,
            end: 16
        }]);
    });

    it('matches only valid type prefixes (lowercase alpha start)', () => {
        // @123test is not a valid mention type
        const result = parser.parse('Call @123test and @Valid here');
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe('Valid');
    });
});

// ---------------------------------------------------------------------------
// MentionResolver
// ---------------------------------------------------------------------------
describe('MentionResolver', () => {
    let resolver;

    beforeEach(() => {
        resolver = new MentionResolver({
            ai: (mention, ctx) => ({
                target: 'ai-service',
                payload: { prompt: ctx.body, mention }
            }),
            user: (mention) => ({
                target: 'user-profile',
                payload: { userId: mention.id }
            })
        });
    });

    it('resolves registered ai type', () => {
        const result = resolver.resolve(
            { type: 'ai', id: null },
            { body: 'Fix the bug' }
        );
        expect(result).toEqual({
            target: 'ai-service',
            payload: { prompt: 'Fix the bug', mention: { type: 'ai', id: null } }
        });
    });

    it('resolves registered user type', () => {
        const result = resolver.resolve({ type: 'user', id: 'alice' });
        expect(result).toEqual({
            target: 'user-profile',
            payload: { userId: 'alice' }
        });
    });

    it('returns null for unregistered type', () => {
        const result = resolver.resolve({ type: 'unknown', id: null });
        expect(result).toBeNull();
    });

    it('returns null when resolver throws', () => {
        resolver.register('fragile', () => { throw new Error('boom'); });
        const result = resolver.resolve({ type: 'fragile', id: null });
        expect(result).toBeNull();
    });

    it('supports register and unregister', () => {
        resolver.register('group', () => ({ target: 'group', payload: {} }));
        expect(resolver.resolve({ type: 'group', id: 'design' }))
            .toEqual({ target: 'group', payload: {} });

        resolver.unregister('group');
        expect(resolver.resolve({ type: 'group', id: 'design' })).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// MentionBridge
// ---------------------------------------------------------------------------
describe('MentionBridge', () => {
    let eventBus;
    let listeners;
    beforeEach(() => {
        listeners = {};
        eventBus = {
            subscribe: vi.fn((event, fn) => {
                listeners[event] = fn;
                return () => { delete listeners[event]; };
            }),
            publish: vi.fn()
        };
    });

    function emit(event) {
        if (listeners[event]) {
            // Call the listener as if it came from EventBus (no return expected)
            listeners[event](event);
        }
    }

    it('triggers AI call for @ai mention via MENTION_DETECTED', async () => {
        const aiService = {
            generateText: vi.fn().mockResolvedValue('Response text')
        };

        const bridge = new MentionBridge(eventBus);
        bridge.init({ aiService });

        const detectedPayload = {
            source: 'comments',
            sourceId: 'comment-1',
            body: 'Fix this @ai',
            mentions: [
                { type: 'ai', id: null, raw: '@ai', start: 9, end: 12 }
            ],
            context: { docType: 'markdown', surroundingContent: 'some text' },
            timestamp: Date.now()
        };

        // Simulate the event firing
        await bridge._handleMentions(detectedPayload);

        expect(aiService.generateText).toHaveBeenCalledTimes(1);
        expect(aiService.generateText).toHaveBeenCalledWith({
            system: expect.stringContaining('markdown'),
            prompt: 'Fix this @ai',
            stream: false
        });

        expect(eventBus.publish).toHaveBeenCalledWith(
            'MENTION_AI_TASK_COMPLETED',
            expect.objectContaining({
                source: 'comments',
                sourceId: 'comment-1',
                response: 'Response text'
            })
        );
    });

    it('publishes error when AI service fails', async () => {
        const aiService = {
            generateText: vi.fn().mockRejectedValue(new Error('API down'))
        };

        const bridge = new MentionBridge(eventBus);
        bridge.init({ aiService });

        const detectedPayload = {
            source: 'comments',
            sourceId: 'comment-1',
            body: 'Fix this @ai',
            mentions: [
                { type: 'ai', id: null, raw: '@ai', start: 9, end: 12 }
            ],
            context: {},
            timestamp: Date.now()
        };

        await bridge._handleMentions(detectedPayload);

        expect(eventBus.publish).toHaveBeenCalledWith(
            'MENTION_AI_TASK_COMPLETED',
            expect.objectContaining({
                source: 'comments',
                sourceId: 'comment-1',
                error: 'API down'
            })
        );
    });

    it('skips when no AI service is provided', async () => {
        const bridge = new MentionBridge(eventBus);
        bridge.init(); // no aiService

        const detectedPayload = {
            source: 'comments',
            sourceId: 'comment-1',
            body: 'Fix this @ai',
            mentions: [
                { type: 'ai', id: null, raw: '@ai', start: 9, end: 12 }
            ],
            context: {},
            timestamp: Date.now()
        };

        // init with no aiService means no subscription
        expect(eventBus.subscribe).not.toHaveBeenCalled();
        await bridge._handleMentions(detectedPayload);

        expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('skips non-ai mentions', async () => {
        const aiService = {
            generateText: vi.fn()
        };

        const bridge = new MentionBridge(eventBus);
        bridge.init({ aiService });

        const detectedPayload = {
            source: 'comments',
            sourceId: 'comment-1',
            body: 'Fix this @user:alice',
            mentions: [
                { type: 'user', id: 'alice', raw: '@user:alice', start: 9, end: 21 }
            ],
            context: {},
            timestamp: Date.now()
        };

        await bridge._handleMentions(detectedPayload);

        expect(aiService.generateText).not.toHaveBeenCalled();
    });

    it('destroy cleans up subscriptions', () => {
        const aiService = {
            generateText: vi.fn()
        };

        const bridge = new MentionBridge(eventBus);
        bridge.init({ aiService });

        expect(eventBus.subscribe).toHaveBeenCalledTimes(1);
        bridge.destroy();

        expect(bridge.initialized).toBe(false);
        expect(bridge.aiService).toBeNull();
        // Listener was removed via the unsubscriber
        expect(listeners['MENTION_DETECTED']).toBeUndefined();
    });

    it('re-init destroys previous state first', () => {
        const aiService = { generateText: vi.fn() };
        const aiService2 = { generateText: vi.fn() };

        const bridge = new MentionBridge(eventBus);
        bridge.init({ aiService });
        expect(eventBus.subscribe).toHaveBeenCalledTimes(1);
        bridge.init({ aiService: aiService2 });
        // Should have called subscribe again (destroy cleaned old, init set new)
        expect(eventBus.subscribe).toHaveBeenCalledTimes(2);
    });

    it('_buildSystemPrompt includes docType and surroundingContent', () => {
        const bridge = new MentionBridge(eventBus);
        const prompt = bridge._buildSystemPrompt({
            docType: 'markdown',
            surroundingContent: 'Line 1\nLine 2'
        });

        expect(prompt).toContain('Document type: markdown');
        expect(prompt).toContain('Content around the comment:');
        expect(prompt).toContain('Line 1\nLine 2');
        expect(prompt).toContain('Be concise');
    });

    it('_buildSystemPrompt works with empty context', () => {
        const bridge = new MentionBridge(eventBus);
        const prompt = bridge._buildSystemPrompt();
        expect(prompt).toContain('helping a user edit a document');
        expect(prompt).not.toContain('Document type');
    });
});
