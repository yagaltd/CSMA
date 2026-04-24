import { NotificationsContracts } from '../contracts/notifications-contracts.js';

const DEFAULT_CONSENT_CATEGORY = 'preferences';
const DEFAULT_COPY = {
    centerTitle: 'Notifications',
    centerDescription: 'Recent alerts and background updates.',
    emptyTitle: 'No notifications',
    emptyDescription: 'New items appear here as they arrive.',
    launcherLabel: 'Open notifications',
    open: 'Open',
    close: 'Close',
    markAllRead: 'Mark all read',
    clear: 'Clear all',
    permissionGrantedTitle: 'Notifications enabled',
    permissionGrantedDescription: 'Browser notifications are allowed.',
    permissionDeniedTitle: 'Notifications blocked',
    permissionDeniedDescription: 'This browser will not show notifications.',
    permissionUnsupportedTitle: 'Notifications unavailable',
    permissionUnsupportedDescription: 'This browser does not support notifications.',
    pushSubscribedTitle: 'Push subscribed',
    pushSubscribedDescription: 'Background delivery is active.',
    pushAlreadySubscribedTitle: 'Push already active',
    pushAlreadySubscribedDescription: 'The current subscription is already registered.',
    pushUnsubscribedTitle: 'Push unsubscribed',
    pushUnsubscribedDescription: 'Background delivery has been turned off.',
    consentBlockedTitle: 'Notifications paused',
    consentBlockedDescription: 'Enable preferences consent to receive background notifications.',
    queueTitle: 'Notification received',
    queueDescription: 'Open the notifications center to review it.',
    readTitle: 'Notification marked read',
    readDescription: 'The notification was marked as read.',
    readAllTitle: 'All notifications read',
    readAllDescription: 'No unread notifications remain.',
    removedTitle: 'Notification removed',
    removedDescription: 'The notification was removed from the list.',
    clearedTitle: 'Notifications cleared',
    clearedDescription: 'All notifications were removed.'
};

let fallbackId = 0;

function createDefaultPermissionState() {
    const supported = typeof globalThis.Notification !== 'undefined' && typeof globalThis.Notification?.permission === 'string';
    return {
        supported,
        permission: supported ? globalThis.Notification.permission : 'unsupported',
        requested: false,
        lastRequestedAt: 0,
        lastResult: null,
        consented: true
    };
}

function createDefaultPushState() {
    return {
        supported: typeof globalThis.PushManager !== 'undefined' && typeof navigator !== 'undefined' && Boolean(navigator.serviceWorker),
        subscribed: false,
        endpoint: null,
        consented: true,
        lastUpdatedAt: 0
    };
}

function now() {
    return Date.now();
}

function createId(prefix = 'notification') {
    if (globalThis.crypto?.randomUUID) {
        return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
    fallbackId += 1;
    return `${prefix}-${now()}-${fallbackId}`;
}

function normalizeString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getNotificationApi() {
    return typeof globalThis.Notification !== 'undefined' ? globalThis.Notification : null;
}

function createToastPayload(type, title, description, duration) {
    return {
        type,
        title,
        description,
        duration
    };
}

function publishToast(eventBus, type, title, description, duration = 3200) {
    eventBus?.publish?.('INTENT_TOAST_SHOW', createToastPayload(type, title, description, duration));
}

function validatePayload(eventName, payload) {
    const contract = NotificationsContracts[eventName];
    if (!contract?.schema?.validate) {
        return true;
    }
    const [error] = contract.schema.validate(payload);
    if (error) {
        throw new Error(`Invalid ${eventName} payload: ${error.message || error}`);
    }
    return true;
}

function cloneNotification(notification) {
    return {
        id: notification.id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        read: notification.read,
        source: notification.source,
        tag: notification.tag,
        actionUrl: notification.actionUrl,
        silent: notification.silent,
        delivered: notification.delivered,
        timestamp: notification.timestamp
    };
}

function clonePermissionState(permission, consented) {
    return {
        supported: Boolean(permission.supported),
        permission: permission.permission,
        requested: Boolean(permission.requested),
        lastRequestedAt: permission.lastRequestedAt || 0,
        lastResult: permission.lastResult || null,
        consented: Boolean(consented)
    };
}

function clonePushState(push, consented) {
    return {
        supported: Boolean(push.supported),
        subscribed: Boolean(push.subscribed),
        endpoint: push.endpoint || null,
        consented: Boolean(consented),
        lastUpdatedAt: push.lastUpdatedAt || 0
    };
}

function normalizeApplicationServerKey(key) {
    if (!key) {
        return undefined;
    }
    if (key instanceof Uint8Array || key instanceof ArrayBuffer) {
        return key;
    }
    if (typeof key !== 'string') {
        return undefined;
    }

    const padding = '='.repeat((4 - (key.length % 4)) % 4);
    const base64 = `${key}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof globalThis.atob === 'function') {
        const raw = globalThis.atob(base64);
        const bytes = new Uint8Array(raw.length);
        for (let index = 0; index < raw.length; index += 1) {
            bytes[index] = raw.charCodeAt(index);
        }
        return bytes;
    }
    return undefined;
}

export class NotificationsService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...options };
        this.copy = { ...DEFAULT_COPY, ...(options.copy || {}) };
        this.consentService = options.consent || null;
        this.consentCategory = options.consentCategory || DEFAULT_CONSENT_CATEGORY;
        this.notifications = [];
        this.permission = createDefaultPermissionState();
        this.push = createDefaultPushState();
        this.centerOpen = false;
        this.pushSubscription = null;
        this.cleanup = null;
        this.initialized = false;
    }

    init(options = {}) {
        this.options = { ...this.options, ...options };
        this.copy = { ...DEFAULT_COPY, ...(this.options.copy || {}) };
        this.consentService = options.consent || this.consentService || globalThis.window?.csma?.consent || null;
        this.consentCategory = options.consentCategory || this.consentCategory || DEFAULT_CONSENT_CATEGORY;
        this.permission = createDefaultPermissionState();
        this.push = createDefaultPushState();
        this.centerOpen = Boolean(options.initialCenterOpen);
        this.initialized = true;
        this.setupIntentHandlers();
        this.publishState('init');
        return this;
    }

    destroy() {
        this.cleanup?.();
        this.cleanup = null;
        this.centerOpen = false;
        this.pushSubscription = null;
        this.initialized = false;
    }

    getState() {
        return {
            notifications: this.notifications.map((notification) => cloneNotification(notification)),
            unreadCount: this.notifications.filter((notification) => !notification.read).length,
            centerOpen: this.centerOpen,
            permission: clonePermissionState(this.permission, this.hasDeliveryConsent()),
            push: clonePushState(this.push, this.hasDeliveryConsent()),
            copy: { ...this.copy }
        };
    }

    getPermissionState() {
        return clonePermissionState(this.permission, this.hasDeliveryConsent());
    }

    async requestPermission(source = 'api') {
        const NotificationApi = getNotificationApi();
        const timestamp = now();

        if (!NotificationApi?.requestPermission) {
            this.permission = {
                ...this.permission,
                supported: false,
                permission: 'unsupported',
                requested: true,
                lastRequestedAt: timestamp,
                lastResult: 'unsupported'
            };
            this.publishPermissionChanged('unsupported', source, timestamp);
            publishToast(this.eventBus, 'warning', this.copy.permissionUnsupportedTitle, this.copy.permissionUnsupportedDescription);
            this.publishState('permission-requested');
            return this.getPermissionState();
        }

        const current = NotificationApi.permission || 'default';
        if (current === 'granted' || current === 'denied') {
            this.permission = {
                ...this.permission,
                supported: true,
                permission: current,
                requested: true,
                lastRequestedAt: timestamp,
                lastResult: current
            };
            this.publishPermissionChanged(current, source, timestamp);
            this.publishPermissionToast(current);
            this.publishState('permission-requested');
            return this.getPermissionState();
        }

        const request = NotificationApi.requestPermission.bind(NotificationApi);
        const permission = await this.resolvePermissionRequest(request);

        this.permission = {
            ...this.permission,
            supported: true,
            permission: permission || NotificationApi.permission || 'default',
            requested: true,
            lastRequestedAt: timestamp,
            lastResult: permission || NotificationApi.permission || 'default'
        };
        this.publishPermissionChanged(this.permission.permission, source, timestamp);
        this.publishPermissionToast(this.permission.permission);
        this.publishState('permission-requested');
        return this.getPermissionState();
    }

    async subscribePush(options = {}) {
        const timestamp = now();
        this.push.supported = this.detectPushSupport();
        this.push.consented = this.hasDeliveryConsent();

        if (!this.push.consented) {
            publishToast(this.eventBus, 'warning', this.copy.consentBlockedTitle, this.copy.consentBlockedDescription, 4200);
            this.publishState('push-blocked');
            return null;
        }

        if (!this.push.supported) {
            publishToast(this.eventBus, 'warning', this.copy.permissionUnsupportedTitle, this.copy.permissionUnsupportedDescription);
            this.publishState('push-unsupported');
            return null;
        }

        if (this.permission.permission !== 'granted') {
            publishToast(this.eventBus, 'warning', this.copy.permissionDeniedTitle, 'Browser notification permission is required before subscribing to push notifications.', 4200);
            this.publishState('push-needs-permission');
            return null;
        }

        const registration = await this.resolveServiceWorkerRegistration(options);
        if (!registration?.pushManager) {
            this.publishState('push-unavailable');
            return null;
        }

        const existing = await registration.pushManager.getSubscription?.();
        if (existing) {
            this.pushSubscription = existing;
            this.push = {
                ...this.push,
                subscribed: true,
                endpoint: existing.endpoint || null,
                lastUpdatedAt: timestamp
            };
            this.publishPushChanged('already-subscribed', timestamp);
            publishToast(this.eventBus, 'info', this.copy.pushAlreadySubscribedTitle, this.copy.pushAlreadySubscribedDescription, 3200);
            this.publishState('push-subscribed');
            return existing;
        }

        const subscribeOptions = {
            userVisibleOnly: options.userVisibleOnly ?? this.options.userVisibleOnly ?? true,
            applicationServerKey: normalizeApplicationServerKey(
                options.applicationServerKey || this.options.applicationServerKey
            )
        };

        const subscription = await registration.pushManager.subscribe(subscribeOptions);
        this.pushSubscription = subscription;
        this.push = {
            ...this.push,
            subscribed: true,
            endpoint: subscription?.endpoint || null,
            lastUpdatedAt: timestamp
        };
        this.publishPushChanged('subscribed', timestamp);
        publishToast(this.eventBus, 'success', this.copy.pushSubscribedTitle, this.copy.pushSubscribedDescription);
        this.publishState('push-subscribed');
        return subscription;
    }

    async unsubscribePush(source = 'api') {
        const timestamp = now();
        const subscription = this.pushSubscription || await this.resolveExistingPushSubscription();
        if (!subscription) {
            this.publishState('push-unsubscribed');
            return false;
        }

        const unsubscribed = await subscription.unsubscribe?.();
        if (unsubscribed !== false) {
            this.pushSubscription = null;
            this.push = {
                ...this.push,
                subscribed: false,
                endpoint: null,
                lastUpdatedAt: timestamp
            };
            this.publishPushChanged('unsubscribed', timestamp);
            publishToast(this.eventBus, 'info', this.copy.pushUnsubscribedTitle, this.copy.pushUnsubscribedDescription);
            this.publishState('push-unsubscribed');
        }
        return Boolean(unsubscribed);
    }

    enqueue(notification = {}) {
        const timestamp = notification.timestamp || now();
        const item = {
            id: notification.id || createId(),
            title: normalizeString(notification.title) || 'Notification',
            body: normalizeString(notification.body),
            type: notification.type || 'default',
            read: Boolean(notification.read),
            source: notification.source || 'api',
            tag: normalizeString(notification.tag),
            actionUrl: normalizeString(notification.actionUrl),
            silent: Boolean(notification.silent),
            delivered: false,
            timestamp,
            handle: null
        };

        this.notifications.unshift(item);

        if (this.shouldDeliverNativeNotifications(item)) {
            item.delivered = this.deliverNativeNotification(item);
        }

        publishToast(
            this.eventBus,
            item.type === 'error' ? 'error' : item.type === 'warning' ? 'warning' : 'default',
            item.title,
            item.body || this.copy.queueDescription,
            2800
        );

        this.publishNotificationEvent('NOTIFICATION_ENQUEUED', {
            notification: cloneNotification(item),
            delivered: item.delivered,
            timestamp
        });
        this.publishState('enqueue');
        return cloneNotification(item);
    }

    markRead(id, source = 'api') {
        const item = this.notifications.find((notification) => notification.id === id);
        if (!item) {
            return null;
        }

        item.read = true;
        this.closeNotificationHandle(item);
        publishToast(this.eventBus, 'info', this.copy.readTitle, this.copy.readDescription);
        this.publishNotificationEvent('NOTIFICATION_READ', {
            notification: cloneNotification(item),
            timestamp: now()
        });
        this.publishState('mark-read');
        return cloneNotification(item);
    }

    markAllRead(source = 'api') {
        const timestamp = now();
        this.notifications.forEach((notification) => {
            notification.read = true;
            this.closeNotificationHandle(notification);
        });

        publishToast(this.eventBus, 'info', this.copy.readAllTitle, this.copy.readAllDescription);
        this.publishNotificationEvent('NOTIFICATIONS_READ_ALL', {
            unreadCount: 0,
            timestamp
        });
        this.publishState('mark-all-read');
        return this.getState();
    }

    remove(id, source = 'api') {
        const index = this.notifications.findIndex((notification) => notification.id === id);
        if (index < 0) {
            return null;
        }

        const [item] = this.notifications.splice(index, 1);
        this.closeNotificationHandle(item);
        publishToast(this.eventBus, 'info', this.copy.removedTitle, this.copy.removedDescription);
        this.publishNotificationEvent('NOTIFICATION_REMOVED', {
            notification: cloneNotification(item),
            timestamp: now()
        });
        this.publishState('remove');
        return cloneNotification(item);
    }

    clear(source = 'api') {
        const count = this.notifications.length;
        this.notifications.forEach((notification) => this.closeNotificationHandle(notification));
        this.notifications = [];
        publishToast(this.eventBus, 'info', this.copy.clearedTitle, this.copy.clearedDescription);
        this.publishNotificationEvent('NOTIFICATIONS_CLEARED', {
            count,
            timestamp: now()
        });
        this.publishState('clear');
        return count;
    }

    openCenter(source = 'api') {
        this.centerOpen = true;
        this.publishCenterEvent('NOTIFICATIONS_CENTER_OPENED');
        this.publishState('open-center');
        return this.getState();
    }

    closeCenter(source = 'api') {
        this.centerOpen = false;
        this.publishCenterEvent('NOTIFICATIONS_CENTER_CLOSED');
        this.publishState('close-center');
        return this.getState();
    }

    setupIntentHandlers() {
        this.cleanup?.();
        const subscriptions = [];
        const subscribe = (eventName, handler) => {
            const unsubscribe = this.eventBus?.subscribe?.(eventName, handler);
            if (unsubscribe) {
                subscriptions.push(unsubscribe);
            }
        };

        subscribe('INTENT_NOTIFICATIONS_REQUEST_PERMISSION', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_REQUEST_PERMISSION', payload)) {
                return;
            }
            this.requestPermission(payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_SUBSCRIBE_PUSH', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_SUBSCRIBE_PUSH', payload)) {
                return;
            }
            this.subscribePush(payload);
        });

        subscribe('INTENT_NOTIFICATIONS_UNSUBSCRIBE_PUSH', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_UNSUBSCRIBE_PUSH', payload)) {
                return;
            }
            this.unsubscribePush(payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_ENQUEUE', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_ENQUEUE', payload)) {
                return;
            }
            this.enqueue(payload);
        });

        subscribe('INTENT_NOTIFICATIONS_MARK_READ', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_MARK_READ', payload)) {
                return;
            }
            this.markRead(payload.id, payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_MARK_ALL_READ', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_MARK_ALL_READ', payload)) {
                return;
            }
            this.markAllRead(payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_REMOVE', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_REMOVE', payload)) {
                return;
            }
            this.remove(payload.id, payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_CLEAR', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_CLEAR', payload)) {
                return;
            }
            this.clear(payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_OPEN_CENTER', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_OPEN_CENTER', payload)) {
                return;
            }
            this.openCenter(payload.source || 'event');
        });

        subscribe('INTENT_NOTIFICATIONS_CLOSE_CENTER', (payload = {}) => {
            if (!this.validateIntent('INTENT_NOTIFICATIONS_CLOSE_CENTER', payload)) {
                return;
            }
            this.closeCenter(payload.source || 'event');
        });

        this.cleanup = () => {
            subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        };
    }

    validateIntent(eventName, payload) {
        try {
            validatePayload(eventName, payload);
            return true;
        } catch {
            return false;
        }
    }

    validateNotificationEvent(eventName, payload) {
        validatePayload(eventName, payload);
    }

    publishNotificationEvent(eventName, payload) {
        this.validateNotificationEvent(eventName, payload);
        this.eventBus?.publish?.(eventName, payload);
    }

    publishPermissionChanged(permission, source, timestamp) {
        this.eventBus?.publish?.('NOTIFICATIONS_PERMISSION_CHANGED', {
            source,
            permission,
            timestamp
        });
    }

    publishPushChanged(reason, timestamp) {
        this.eventBus?.publish?.('NOTIFICATIONS_PUSH_SUBSCRIBED', {
            endpoint: this.pushSubscription?.endpoint || null,
            consented: this.hasDeliveryConsent(),
            timestamp
        });
        if (reason === 'unsubscribed') {
            this.eventBus?.publish?.('NOTIFICATIONS_PUSH_UNSUBSCRIBED', {
                consented: this.hasDeliveryConsent(),
                timestamp
            });
        }
    }

    publishCenterEvent(eventName) {
        this.eventBus?.publish?.(eventName, {
            timestamp: now()
        });
    }

    publishPermissionToast(permission) {
        if (permission === 'granted') {
            publishToast(this.eventBus, 'success', this.copy.permissionGrantedTitle, this.copy.permissionGrantedDescription);
        } else if (permission === 'denied') {
            publishToast(this.eventBus, 'warning', this.copy.permissionDeniedTitle, this.copy.permissionDeniedDescription, 4200);
        }
    }

    publishState(reason) {
        const state = this.getState();
        const payload = {
            notifications: state.notifications,
            unreadCount: state.unreadCount,
            centerOpen: state.centerOpen,
            permission: state.permission,
            push: state.push,
            reason,
            timestamp: now()
        };
        this.validateNotificationEvent('NOTIFICATIONS_STATE_CHANGED', payload);
        this.eventBus?.publish?.('NOTIFICATIONS_STATE_CHANGED', payload);
    }

    shouldDeliverNativeNotifications(item) {
        return !item.silent && this.permission.permission === 'granted' && this.hasDeliveryConsent();
    }

    deliverNativeNotification(item) {
        const NotificationApi = getNotificationApi();
        if (!NotificationApi || typeof NotificationApi !== 'function' || NotificationApi.permission !== 'granted') {
            return false;
        }

        try {
            const handle = new NotificationApi(item.title, {
                body: item.body || '',
                tag: item.tag || undefined,
                data: {
                    id: item.id,
                    actionUrl: item.actionUrl || null,
                    source: item.source || null
                },
                silent: item.silent,
                requireInteraction: item.type === 'error'
            });
            item.handle = handle;
            return true;
        } catch {
            return false;
        }
    }

    closeNotificationHandle(item) {
        if (!item?.handle?.close) {
            return;
        }
        try {
            item.handle.close();
        } catch {
            // Ignore notification close failures.
        }
        item.handle = null;
    }

    hasDeliveryConsent() {
        const consent = this.resolveConsentService();
        if (!consent) {
            return true;
        }
        if (typeof consent.hasConsent === 'function') {
            return Boolean(consent.hasConsent(this.consentCategory));
        }
        if (typeof consent.getConsent === 'function') {
            return Boolean(consent.getConsent(this.consentCategory));
        }
        return true;
    }

    resolveConsentService() {
        return this.options.consent || this.consentService || globalThis.window?.csma?.consent || null;
    }

    detectPushSupport() {
        return typeof globalThis.PushManager !== 'undefined'
            && typeof navigator !== 'undefined'
            && Boolean(navigator.serviceWorker);
    }

    async resolveServiceWorkerRegistration(options = {}) {
        if (options.serviceWorkerRegistration) {
            return options.serviceWorkerRegistration;
        }
        if (this.options.serviceWorkerRegistration) {
            return this.options.serviceWorkerRegistration;
        }

        if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
            return null;
        }

        if (navigator.serviceWorker.ready) {
            return navigator.serviceWorker.ready;
        }

        if (navigator.serviceWorker.getRegistration) {
            return navigator.serviceWorker.getRegistration();
        }

        return null;
    }

    async resolveExistingPushSubscription() {
        const registration = await this.resolveServiceWorkerRegistration();
        if (!registration?.pushManager?.getSubscription) {
            return null;
        }
        return registration.pushManager.getSubscription();
    }

    async resolvePermissionRequest(requestFn) {
        return new Promise((resolve) => {
            let settled = false;
            const finish = (result) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(result);
            };
            const result = requestFn((value) => finish(value));
            if (result && typeof result.then === 'function') {
                result.then(finish).catch(() => finish('default'));
            } else if (typeof result === 'string') {
                finish(result);
            } else if (requestFn.length === 0) {
                finish(result);
            } else {
                setTimeout(() => finish(getNotificationApi()?.permission || 'default'), 0);
            }
        });
    }
}

export function createNotificationsService(eventBus, options = {}) {
    const service = new NotificationsService(eventBus, options);
    service.init(options);
    return service;
}
