import { object, array, string, number, boolean, optional, enums } from '../../../runtime/validation/index.js';

const NotificationSchema = object({
    id: string(),
    title: string(),
    body: optional(string()),
    type: enums(['default', 'success', 'warning', 'error', 'info']),
    read: boolean(),
    source: optional(string()),
    tag: optional(string()),
    actionUrl: optional(string()),
    silent: boolean(),
    delivered: boolean(),
    timestamp: number()
});

const PermissionSchema = object({
    supported: boolean(),
    permission: enums(['unsupported', 'default', 'granted', 'denied']),
    requested: boolean(),
    lastRequestedAt: number(),
    lastResult: optional(enums(['unsupported', 'default', 'granted', 'denied'])),
    consented: boolean()
});

const PushSchema = object({
    supported: boolean(),
    subscribed: boolean(),
    endpoint: optional(string()),
    consented: boolean(),
    lastUpdatedAt: number()
});

const NotificationsStateSchema = object({
    notifications: array(NotificationSchema),
    unreadCount: number(),
    centerOpen: boolean(),
    permission: PermissionSchema,
    push: PushSchema,
    reason: optional(string()),
    timestamp: number()
});

const NotificationIntentSchema = object({
    source: optional(string()),
    timestamp: number()
});

const NotificationItemIntentSchema = object({
    id: optional(string()),
    title: optional(string()),
    body: optional(string()),
    type: optional(enums(['default', 'success', 'warning', 'error', 'info'])),
    tag: optional(string()),
    actionUrl: optional(string()),
    silent: optional(boolean()),
    source: optional(string()),
    timestamp: number()
});

const NotificationToggleIntentSchema = object({
    id: string(),
    source: optional(string()),
    timestamp: number()
});

const NotificationPushIntentSchema = object({
    source: optional(string()),
    applicationServerKey: optional(string()),
    userVisibleOnly: optional(boolean()),
    timestamp: number()
});

const NotificationPermissionResultSchema = object({
    source: optional(string()),
    permission: enums(['unsupported', 'default', 'granted', 'denied']),
    timestamp: number()
});

export const NotificationsContracts = {
    INTENT_NOTIFICATIONS_REQUEST_PERMISSION: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to request browser notification permission',
        schema: NotificationIntentSchema
    },

    INTENT_NOTIFICATIONS_SUBSCRIBE_PUSH: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to subscribe for push notifications',
        schema: NotificationPushIntentSchema
    },

    INTENT_NOTIFICATIONS_UNSUBSCRIBE_PUSH: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to unsubscribe from push notifications',
        schema: NotificationIntentSchema
    },

    INTENT_NOTIFICATIONS_ENQUEUE: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User or service intends to enqueue a notification',
        schema: NotificationItemIntentSchema
    },

    INTENT_NOTIFICATIONS_MARK_READ: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to mark one notification as read',
        schema: NotificationToggleIntentSchema
    },

    INTENT_NOTIFICATIONS_MARK_ALL_READ: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to mark all notifications as read',
        schema: NotificationIntentSchema
    },

    INTENT_NOTIFICATIONS_REMOVE: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to remove one notification',
        schema: NotificationToggleIntentSchema
    },

    INTENT_NOTIFICATIONS_CLEAR: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to clear all notifications',
        schema: NotificationIntentSchema
    },

    INTENT_NOTIFICATIONS_OPEN_CENTER: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to open the notifications center',
        schema: NotificationIntentSchema
    },

    INTENT_NOTIFICATIONS_CLOSE_CENTER: {
        version: 1,
        type: 'intent',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'User intends to close the notifications center',
        schema: NotificationIntentSchema
    },

    NOTIFICATIONS_STATE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published whenever the notifications state changes',
        schema: NotificationsStateSchema
    },

    NOTIFICATIONS_PERMISSION_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when browser notification permission changes',
        schema: NotificationPermissionResultSchema
    },

    NOTIFICATIONS_PUSH_SUBSCRIBED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when push subscription succeeds',
        schema: object({
            endpoint: optional(string()),
            consented: boolean(),
            timestamp: number()
        })
    },

    NOTIFICATIONS_PUSH_UNSUBSCRIBED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when push subscription is removed',
        schema: object({
            consented: boolean(),
            timestamp: number()
        })
    },

    NOTIFICATIONS_CENTER_OPENED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when the notifications center opens',
        schema: object({
            timestamp: number()
        })
    },

    NOTIFICATIONS_CENTER_CLOSED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when the notifications center closes',
        schema: object({
            timestamp: number()
        })
    },

    NOTIFICATION_ENQUEUED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a notification is added to the queue',
        schema: object({
            notification: NotificationSchema,
            delivered: boolean(),
            timestamp: number()
        })
    },

    NOTIFICATION_READ: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a notification is marked as read',
        schema: object({
            notification: NotificationSchema,
            timestamp: number()
        })
    },

    NOTIFICATIONS_READ_ALL: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when all notifications are marked as read',
        schema: object({
            unreadCount: number(),
            timestamp: number()
        })
    },

    NOTIFICATION_REMOVED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when a notification is removed',
        schema: object({
            notification: NotificationSchema,
            timestamp: number()
        })
    },

    NOTIFICATIONS_CLEARED: {
        version: 1,
        type: 'event',
        owner: 'notifications',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when all notifications are cleared',
        schema: object({
            count: number(),
            timestamp: number()
        })
    }
};
