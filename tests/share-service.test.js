import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createShareService } from '../src/modules/share/index.js';
import { ShareContracts } from '../src/modules/share/contracts/share-contracts.js';

function createEventBus() {
    const handlers = new Map();
    return {
        publish: vi.fn((eventName, payload) => {
            handlers.get(eventName)?.forEach((handler) => handler(payload));
        }),
        publishSync: vi.fn((eventName, payload) => {
            handlers.get(eventName)?.forEach((handler) => handler(payload));
        }),
        subscribe: vi.fn((eventName, handler) => {
            if (!handlers.has(eventName)) {
                handlers.set(eventName, new Set());
            }
            handlers.get(eventName).add(handler);
            return () => handlers.get(eventName)?.delete(handler);
        }),
        emit(eventName, payload) {
            handlers.get(eventName)?.forEach((handler) => handler(payload));
        }
    };
}

describe('ShareService', () => {
    let originalNavigator;

    beforeEach(() => {
        originalNavigator = globalThis.navigator;
    });

    afterEach(() => {
        if (originalNavigator === undefined) {
            delete globalThis.navigator;
        } else {
            Object.defineProperty(globalThis, 'navigator', {
                configurable: true,
                value: originalNavigator
            });
        }
        vi.restoreAllMocks();
    });

    it('shares through Web Share first and emits completion', async () => {
        const eventBus = createEventBus();
        const share = vi.fn().mockResolvedValue(undefined);
        const clipboard = { writeText: vi.fn() };

        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                share,
                canShare: vi.fn().mockReturnValue(true),
                clipboard
            }
        });

        const service = createShareService(eventBus);
        const result = await service.request({
            title: 'Release notes',
            text: 'Version 2.0 is live',
            url: 'https://example.com/releases/2',
            timestamp: Date.now()
        });

        expect(result.ok).toBe(true);
        expect(result.transport).toBe('web-share');
        expect(share).toHaveBeenCalledWith({
            title: 'Release notes',
            text: 'Version 2.0 is live',
            url: 'https://example.com/releases/2'
        });
        expect(clipboard.writeText).not.toHaveBeenCalled();
        expect(eventBus.publishSync).toHaveBeenCalledWith('SHARE_COMPLETED', expect.objectContaining({
            transport: 'web-share'
        }));
    });

    it('falls back to clipboard when Web Share is unavailable', async () => {
        const eventBus = createEventBus();
        const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                clipboard
            }
        });

        const service = createShareService(eventBus);
        const result = await service.request({
            title: 'Copy this',
            text: 'Plain text only',
            timestamp: Date.now()
        });

        expect(result.ok).toBe(true);
        expect(result.transport).toBe('clipboard');
        expect(clipboard.writeText).toHaveBeenCalledWith('Copy this\nPlain text only');
        expect(eventBus.publishSync).toHaveBeenCalledWith('SHARE_COMPLETED', expect.objectContaining({
            transport: 'clipboard'
        }));
    });

    it('rejects unsafe URLs before sharing', async () => {
        const eventBus = createEventBus();
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {}
        });

        const service = createShareService(eventBus);
        const result = await service.request({
            title: 'Unsafe',
            url: 'javascript:alert(1)',
            timestamp: Date.now()
        });

        expect(result.ok).toBe(false);
        expect(result.reason).toBe('unsafe-url');
        expect(eventBus.publishSync).toHaveBeenCalledWith('SHARE_FAILED', expect.objectContaining({
            reason: 'unsafe-url'
        }));
    });

    it('subscribes to INTENT_SHARE_REQUEST and cleans up on destroy', async () => {
        const eventBus = createEventBus();
        const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };

        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                clipboard
            }
        });

        const service = createShareService(eventBus);
        expect(eventBus.subscribe).toHaveBeenCalledWith('INTENT_SHARE_REQUEST', expect.any(Function));

        eventBus.emit('INTENT_SHARE_REQUEST', {
            text: 'Hello from intent',
            timestamp: Date.now()
        });

        expect(clipboard.writeText).toHaveBeenCalled();

        service.destroy();
        clipboard.writeText.mockClear();
        eventBus.emit('INTENT_SHARE_REQUEST', {
            text: 'Should not be handled',
            timestamp: Date.now()
        });

        expect(clipboard.writeText).not.toHaveBeenCalled();
    });

    it('validates the module-local contracts', () => {
        const [okError] = ShareContracts.INTENT_SHARE_REQUEST.schema.validate({
            title: 'Shared',
            text: 'Hello',
            url: 'https://example.com',
            timestamp: Date.now()
        });
        expect(okError).toBeUndefined();

        const [completedError] = ShareContracts.SHARE_COMPLETED.schema.validate({
            title: 'Shared',
            text: 'Hello',
            url: 'https://example.com',
            transport: 'web-share',
            timestamp: Date.now()
        });
        expect(completedError).toBeUndefined();

        const [badError] = ShareContracts.SHARE_FAILED.schema.validate({
            reason: 'invalid-payload',
            message: 'Nope',
            timestamp: Date.now()
        });
        expect(badError).toBeUndefined();

        const [unsafeError] = ShareContracts.INTENT_SHARE_REQUEST.schema.validate({
            title: 'x'.repeat(121),
            timestamp: Date.now()
        });
        expect(unsafeError).toBeDefined();

        const [invalidReasonError] = ShareContracts.SHARE_FAILED.schema.validate({
            reason: 'not-a-real-reason',
            message: 'Nope',
            timestamp: Date.now()
        });
        expect(invalidReasonError).toBeDefined();
    });

    it('reports capability checks', () => {
        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                share: vi.fn(),
                clipboard: { writeText: vi.fn() }
            }
        });

        const service = createShareService(createEventBus());
        expect(service.canShare({ text: 'abc', timestamp: Date.now() })).toBe(true);
        expect(service.canShare({ url: 'javascript:alert(1)', timestamp: Date.now() })).toBe(false);
    });

    it('publishes toast intents when configured', async () => {
        const eventBus = createEventBus();
        const share = vi.fn().mockResolvedValue(undefined);

        Object.defineProperty(globalThis, 'navigator', {
            configurable: true,
            value: {
                share,
                canShare: vi.fn().mockReturnValue(true)
            }
        });

        const service = createShareService(eventBus, {
            toastIntent: 'INTENT_TOAST_SHOW'
        });

        await service.request({
            text: 'Toast me',
            timestamp: Date.now()
        });

        expect(eventBus.publish).toHaveBeenCalledWith('INTENT_TOAST_SHOW', expect.objectContaining({
            title: 'Share complete'
        }));
    });
});
