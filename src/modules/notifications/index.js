import { NotificationsService, createNotificationsService } from './services/NotificationsService.js';
import { NotificationsContracts } from './contracts/notifications-contracts.js';

export const manifest = {
    id: 'notifications',
    name: 'Notifications Module',
    version: '1.0.0',
    description: 'Notification queue, browser permission, push subscription, and optional center UI',
    dependencies: [],
    services: ['notifications'],
    contracts: Object.keys(NotificationsContracts),
    contributes: {
        commands: [],
        navigation: [],
        panels: [],
        adapters: [],
        views: []
    }
};

export const services = {
    notifications: NotificationsService
};

export const contracts = NotificationsContracts;

export { createNotificationsService, NotificationsService };
