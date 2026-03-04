import { describe, it, expect, vi } from 'vitest';
import { ChannelManager } from '../src/runtime/ChannelManager.js';

class StubEventBus {
    constructor() {
        this.publish = vi.fn();
    }
}

describe('ChannelManager', () => {
    it('registers and subscribes to channels', () => {
        const eventBus = new StubEventBus();
        const manager = new ChannelManager(eventBus);
        const load = vi.fn(() => vi.fn());
        manager.registerChannel('todos', { load });

        const unsubscribe = manager.subscribe('todos', { filter: 'open' });
        expect(load).toHaveBeenCalledTimes(1);
        expect(manager.isSubscribed('todos', { filter: 'open' })).toBe(true);

        unsubscribe();
        expect(manager.isSubscribed('todos', { filter: 'open' })).toBe(false);
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_SUBSCRIBED', { id: 'todos', params: { filter: 'open' } });
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_UNSUBSCRIBED', {
            id: 'todos',
            params: { filter: 'open' },
            source: 'manual'
        });
    });

    it('blocks subscription when access returns false', () => {
        const manager = new ChannelManager(new StubEventBus());
        const access = vi.fn(() => false);
        manager.registerChannel('secure', { access });
        const unsubscribe = manager.subscribe('secure', { user: 'guest' });
        expect(access).toHaveBeenCalledWith({ user: 'guest' }, expect.objectContaining({ user: null }));
        expect(manager.isSubscribed('secure', { user: 'guest' })).toBe(false);
        expect(unsubscribe).toBeInstanceOf(Function);
        unsubscribe();
    });

    it('revokes subscriptions when access changes after auth update', () => {
        const eventBus = new StubEventBus();
        const manager = new ChannelManager(eventBus);
        let resolveRole = 'staff';
        manager.setContextResolver(() => ({ role: resolveRole }));

        const access = vi.fn((params, context) => context.user?.role === 'staff');
        manager.registerChannel('ops', { access });

        manager.subscribe('ops', {});
        expect(manager.isSubscribed('ops', {})).toBe(true);

        resolveRole = 'user';
        manager.reevaluateAccess();
        expect(manager.isSubscribed('ops', {})).toBe(false);
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_UNSUBSCRIBED', {
            id: 'ops',
            params: {},
            source: 'access-revoked'
        });
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_ACCESS_REVOKED', { id: 'ops', params: {} });
    });

    it('routes replay payloads to channel handlers', () => {
        const manager = new ChannelManager(new StubEventBus());
        const onReplay = vi.fn();
        const onInvalidate = vi.fn();
        manager.registerChannel('todos', { onReplay, onInvalidate });
        manager.subscribe('todos', { filter: 'all' });

        manager.handleReplay({
            intents: [
                { id: 'a', meta: { channels: ['todos'] }, payload: { title: 'Task' } }
            ]
        });

        expect(onReplay).toHaveBeenCalledTimes(1);
        expect(onReplay).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a' }),
            expect.objectContaining({ channel: 'todos', params: { filter: 'all' } })
        );

        manager.handleInvalidate({
            reason: 'server-update',
            intents: [
                { id: 'a', meta: { channels: ['todos'] }, payload: { title: 'Task' } }
            ]
        });

        expect(onInvalidate).toHaveBeenCalledTimes(1);
        expect(onInvalidate).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a' }),
            expect.objectContaining({ channel: 'todos', reason: 'server-update' })
        );
    });
    it('publishes command requests when filters change and context updates', () => {
        const eventBus = new StubEventBus();
        const manager = new ChannelManager(eventBus);
        manager.registerChannel('todos', {});
        manager.subscribe('todos', { status: 'all' });

        manager.updateFilter('todos', { status: 'all' }, { status: 'open' });
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_COMMAND_REQUEST', {
            id: 'todos',
            params: { status: 'all' },
            command: 'filter',
            args: { filter: { status: 'open' } }
        });

        manager.notifyContextChanged('auth-change');
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_COMMAND_REQUEST', {
            id: 'todos',
            params: { status: 'all' },
            command: 'resend',
            args: { reason: 'auth-change' }
        });
    });

    it('handles server close messages without removing desired subscriptions', () => {
        const eventBus = new StubEventBus();
        const manager = new ChannelManager(eventBus);
        manager.registerChannel('todos', {});
        manager.subscribe('todos', { status: 'all' });
        expect(manager.listSubscriptions()).toHaveLength(1);

        manager.handleClose({ channel: 'todos', params: { status: 'all' }, code: 'ACCESS_DENIED' });
        expect(manager.isSubscribed('todos', { status: 'all' })).toBe(false);
        expect(manager.listSubscriptions()).toHaveLength(1);
        expect(eventBus.publish).toHaveBeenCalledWith('CHANNEL_SERVER_CLOSE', {
            channel: 'todos',
            params: { status: 'all' },
            code: 'ACCESS_DENIED',
            reason: undefined
        });
    });
});
