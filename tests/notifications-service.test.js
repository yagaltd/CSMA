// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNotificationsService } from '../src/modules/notifications/services/NotificationsService.js';
import { NotificationsContracts } from '../src/modules/notifications/contracts/notifications-contracts.js';

function createEventBus() {
    const handlers = new Map();
    return {
        publish: vi.fn(),
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

describe('NotificationsService', () => {
    const originalNotification = globalThis.Notification;
    const originalPushManager = globalThis.PushManager;
    const originalNavigator = globalThis.navigator;
    const originalWindow = globalThis.window;

    beforeEach(() => {
        localStorage.clear();
        const serviceWorkerRegistration = {
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(null),
                subscribe: vi.fn().mockResolvedValue({
                    endpoint: 'https://example.test/push',
                    unsubscribe: vi.fn().mockResolvedValue(true)
                })
            }
        };
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                serviceWorker: {
                    ready: Promise.resolve(serviceWorkerRegistration)
                }
            },
            configurable: true
        });
        globalThis.PushManager = function PushManager() {};
        globalThis.Notification = vi.fn(function Notification(title, options) {
            this.title = title;
            this.options = options;
            this.close = vi.fn();
        });
        globalThis.Notification.permission = 'default';
        globalThis.Notification.requestPermission = vi.fn(() => {
            globalThis.Notification.permission = 'granted';
            return Promise.resolve('granted');
        });
        globalThis.window = globalThis.window || {};
        globalThis.window.csma = {};
    });

    afterEach(() => {
        globalThis.Notification = originalNotification;
        globalThis.PushManager = originalPushManager;
        if (originalNavigator) {
            Object.defineProperty(globalThis, 'navigator', {
                value: originalNavigator,
                configurable: true
            });
        } else {
            delete globalThis.navigator;
        }
        globalThis.window = originalWindow;
    });

    it('does not request notification permission during init', () => {
        const eventBus = createEventBus();
        const service = createNotificationsService(eventBus);

        expect(globalThis.Notification.requestPermission).not.toHaveBeenCalled();
        expect(service.getPermissionState().permission).toBe('default');
    });

    it('requests permission only when explicitly asked and publishes toast feedback', async () => {
        const eventBus = createEventBus();
        const service = createNotificationsService(eventBus);

        const permission = await service.requestPermission('ui');

        expect(globalThis.Notification.requestPermission).toHaveBeenCalledTimes(1);
        expect(permission.permission).toBe('granted');
        expect(eventBus.publish).toHaveBeenCalledWith(
            'NOTIFICATIONS_PERMISSION_CHANGED',
            expect.objectContaining({ permission: 'granted', source: 'ui' })
        );
        expect(eventBus.publish).toHaveBeenCalledWith(
            'INTENT_TOAST_SHOW',
            expect.objectContaining({ type: 'success', title: 'Notifications enabled' })
        );
    });

    it('queues notifications and delivers native notifications when permitted', async () => {
        const eventBus = createEventBus();
        const service = createNotificationsService(eventBus);

        await service.requestPermission('ui');
        const notification = service.enqueue({
            title: 'Build finished',
            body: 'The deployment completed successfully.',
            type: 'success',
            source: 'test'
        });

        expect(globalThis.Notification).toHaveBeenCalledWith(
            'Build finished',
            expect.objectContaining({
                body: 'The deployment completed successfully.',
                requireInteraction: false
            })
        );
        expect(notification.read).toBe(false);
        expect(service.getState().notifications).toHaveLength(1);
        expect(eventBus.publish).toHaveBeenCalledWith(
            'NOTIFICATION_ENQUEUED',
            expect.objectContaining({
                delivered: true
            })
        );
    });

    it('gates push subscription behind preferences consent', async () => {
        const eventBus = createEventBus();
        const consent = { hasConsent: vi.fn(() => false) };
        const service = createNotificationsService(eventBus, { consent });

        const subscription = await service.subscribePush();

        expect(subscription).toBeNull();
        expect(consent.hasConsent).toHaveBeenCalledWith('preferences');
        expect(eventBus.publish).toHaveBeenCalledWith(
            'INTENT_TOAST_SHOW',
            expect.objectContaining({ type: 'warning', title: 'Notifications paused' })
        );
        expect(service.getState().push.subscribed).toBe(false);
    });

    it('subscribes and unsubscribes push when consent and permission are available', async () => {
        const eventBus = createEventBus();
        const consent = { hasConsent: vi.fn(() => true) };
        const serviceWorkerRegistration = {
            pushManager: {
                getSubscription: vi.fn().mockResolvedValue(null),
                subscribe: vi.fn().mockResolvedValue({
                    endpoint: 'https://example.test/push',
                    unsubscribe: vi.fn().mockResolvedValue(true)
                })
            }
        };
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                serviceWorker: {
                    ready: Promise.resolve(serviceWorkerRegistration)
                }
            },
            configurable: true
        });

        const service = createNotificationsService(eventBus, { consent });
        await service.requestPermission('ui');

        const subscription = await service.subscribePush({ applicationServerKey: 'Zm9v' });
        expect(subscription.endpoint).toBe('https://example.test/push');
        expect(serviceWorkerRegistration.pushManager.subscribe).toHaveBeenCalledTimes(1);
        expect(service.getState().push.subscribed).toBe(true);

        const result = await service.unsubscribePush('ui');
        expect(result).toBe(true);
        expect(service.getState().push.subscribed).toBe(false);
    });

    it('marks notifications as read, removes them, and clears the queue', () => {
        const eventBus = createEventBus();
        const service = createNotificationsService(eventBus);
        const first = service.enqueue({ title: 'First', body: 'Body' });
        const second = service.enqueue({ title: 'Second', body: 'Body' });

        service.markRead(first.id, 'ui');
        expect(service.getState().notifications.find((item) => item.id === first.id).read).toBe(true);

        service.markAllRead('ui');
        expect(service.getState().unreadCount).toBe(0);

        service.remove(second.id, 'ui');
        expect(service.getState().notifications).toHaveLength(1);

        const count = service.clear('ui');
        expect(count).toBe(1);
        expect(service.getState().notifications).toHaveLength(0);
    });

    it('validates local contracts for state and notification events', () => {
        const eventBus = createEventBus();
        const service = createNotificationsService(eventBus);
        const notification = service.enqueue({ title: 'Contract check', body: 'ok' });

        const [stateEvent, statePayload] = eventBus.publish.mock.calls.find(([name]) => name === 'NOTIFICATIONS_STATE_CHANGED');
        const [stateError] = NotificationsContracts[stateEvent].schema.validate(statePayload);
        expect(stateError).toBeUndefined();

        const [notificationEvent, notificationPayload] = eventBus.publish.mock.calls.find(([name]) => name === 'NOTIFICATION_ENQUEUED');
        const [notificationError] = NotificationsContracts[notificationEvent].schema.validate(notificationPayload);
        expect(notificationError).toBeUndefined();
        expect(notification.id).toBeTruthy();
    });
});
