// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createNotificationsService } from '../src/modules/notifications/services/NotificationsService.js';
import { initNotificationsCenter } from '../src/modules/notifications/ui/notifications-center.js';

function createEventBus() {
    const handlers = new Map();
    return {
        publish: vi.fn((eventName, payload) => {
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

describe('notifications center UI', () => {
    const originalNotification = globalThis.Notification;
    const originalPushManager = globalThis.PushManager;
    const originalNavigator = globalThis.navigator;

    beforeEach(() => {
        document.body.replaceChildren();
        globalThis.Notification = vi.fn(function Notification(title, options) {
            this.title = title;
            this.options = options;
            this.close = vi.fn();
        });
        globalThis.Notification.permission = 'granted';
        globalThis.PushManager = function PushManager() {};
        Object.defineProperty(globalThis, 'navigator', {
            value: {
                serviceWorker: {
                    ready: Promise.resolve({
                        pushManager: {
                            getSubscription: vi.fn().mockResolvedValue(null),
                            subscribe: vi.fn().mockResolvedValue({
                                endpoint: 'https://example.test/push',
                                unsubscribe: vi.fn().mockResolvedValue(true)
                            })
                        }
                    })
                }
            },
            configurable: true
        });
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
    });

    it('mounts the launcher and center, then reflects state changes', () => {
        const eventBus = createEventBus();
        const service = createNotificationsService(eventBus, {
            consent: { hasConsent: vi.fn(() => true) }
        });

        const cleanup = initNotificationsCenter(service, document);

        expect(document.querySelector('[data-notifications-launcher]')).toBeTruthy();
        expect(document.querySelector('[data-notifications-panel]')).toBeTruthy();

        service.enqueue({ title: 'First alert', body: 'Ready' });

        expect(document.querySelector('[data-notifications-unread]').textContent).toBe('1');
        expect(document.querySelector('[data-notifications-list] .notifications-item')).toBeTruthy();

        document.querySelector('[data-notifications-launcher]').click();
        expect(document.querySelector('[data-notifications-panel]').dataset.open).toBe('true');

        document.querySelector('[data-notifications-action="mark-all-read"]').click();
        expect(service.getState().unreadCount).toBe(0);

        cleanup();
        expect(document.querySelector('[data-notifications-center-shell]')).toBeNull();
    });
});
