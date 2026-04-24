import './notifications-center.css';

const ITEM_ACTIONS = [
    { action: 'mark-read', label: 'Read' },
    { action: 'remove', label: 'Remove' }
];

function createIconSvg() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M10 2a4 4 0 00-4 4v2.3c0 .8-.2 1.6-.6 2.3L4 12v1h12v-1l-1.4-1.4c-.4-.7-.6-1.5-.6-2.3V6a4 4 0 00-4-4zm0 16a2.5 2.5 0 002.4-1.8H7.6A2.5 2.5 0 0010 18z');
    svg.appendChild(path);
    return svg;
}

function createButton(className, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.notificationsAction = action;
    button.textContent = label;
    return button;
}

function createLauncher(service) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button notifications-launcher';
    button.dataset.notificationsLauncher = 'true';
    button.setAttribute('aria-label', service.getState().copy.launcherLabel);
    button.appendChild(createIconSvg());
    return button;
}

function createHeader(service) {
    const header = document.createElement('header');
    header.className = 'notifications-center__header';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'notifications-center__title-wrap';

    const title = document.createElement('h2');
    title.className = 'notifications-center__title';
    title.textContent = service.getState().copy.centerTitle;

    const description = document.createElement('p');
    description.className = 'notifications-center__description';
    description.textContent = service.getState().copy.centerDescription;

    titleWrap.appendChild(title);
    titleWrap.appendChild(description);
    header.appendChild(titleWrap);

    const actions = document.createElement('div');
    actions.className = 'notifications-center__actions';
    actions.appendChild(createButton('button notifications-center__button', service.getState().copy.markAllRead, 'mark-all-read'));
    actions.appendChild(createButton('button notifications-center__button', service.getState().copy.clear, 'clear'));
    actions.appendChild(createButton('button notifications-center__button', service.getState().copy.close, 'close'));
    header.appendChild(actions);

    return header;
}

function createEmptyState(service) {
    const empty = document.createElement('div');
    empty.className = 'notifications-center__empty';

    const title = document.createElement('p');
    title.className = 'notifications-center__empty-title';
    title.textContent = service.getState().copy.emptyTitle;

    const description = document.createElement('p');
    description.className = 'notifications-center__empty-description';
    description.textContent = service.getState().copy.emptyDescription;

    empty.appendChild(title);
    empty.appendChild(description);
    return empty;
}

function createNotificationItem(service, notification) {
    const item = document.createElement('article');
    item.className = 'notifications-item';
    item.dataset.notificationId = notification.id;
    item.dataset.read = notification.read ? 'true' : 'false';
    item.dataset.variant = notification.type;

    const body = document.createElement('div');
    body.className = 'notifications-item__body';

    const title = document.createElement('h3');
    title.className = 'notifications-item__title';
    title.textContent = notification.title;

    body.appendChild(title);

    if (notification.body) {
        const description = document.createElement('p');
        description.className = 'notifications-item__description';
        description.textContent = notification.body;
        body.appendChild(description);
    }

    const meta = document.createElement('div');
    meta.className = 'notifications-item__meta';

    const timestamp = document.createElement('time');
    timestamp.className = 'notifications-item__time';
    timestamp.dateTime = new Date(notification.timestamp).toISOString();
    timestamp.textContent = new Date(notification.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
    meta.appendChild(timestamp);

    if (notification.type) {
        const type = document.createElement('span');
        type.className = 'notifications-item__type';
        type.textContent = notification.type;
        meta.appendChild(type);
    }

    body.appendChild(meta);
    item.appendChild(body);

    const actions = document.createElement('div');
    actions.className = 'notifications-item__actions';
    ITEM_ACTIONS.forEach(({ action, label }) => {
        const button = createButton('button notifications-item__button', label, action);
        button.dataset.notificationId = notification.id;
        if (action === 'mark-read' && notification.read) {
            button.disabled = true;
        }
        actions.appendChild(button);
    });

    item.appendChild(actions);
    return item;
}

function renderList(service, list) {
    list.replaceChildren();
    const state = service.getState();
    const notifications = state.notifications;

    if (notifications.length === 0) {
        list.appendChild(createEmptyState(service));
        return;
    }

    notifications.forEach((notification) => {
        list.appendChild(createNotificationItem(service, notification));
    });
}

function syncCenter(service, shell, launcher, panel, unreadCount, list, status) {
    const state = service.getState();
    shell.dataset.open = state.centerOpen ? 'true' : 'false';
    panel.dataset.open = state.centerOpen ? 'true' : 'false';
    launcher.setAttribute('aria-label', `${state.copy.launcherLabel} (${state.unreadCount})`);
    unreadCount.textContent = String(state.unreadCount);
    unreadCount.hidden = state.unreadCount === 0;
    status.textContent = state.unreadCount > 0
        ? `${state.unreadCount} unread`
        : 'All caught up';
    renderList(service, list);
}

export function initNotificationsCenter(service, root = document) {
    if (!service || !root?.body) {
        return () => {};
    }

    const host = root.querySelector('[data-notifications-center-shell]') || document.createElement('section');
    const owned = !host.isConnected;
    host.className = 'notifications-center-shell';
    host.dataset.notificationsCenterShell = 'true';
    host.dataset.open = service.getState().centerOpen ? 'true' : 'false';

    const launcher = root.querySelector('[data-notifications-launcher]') || createLauncher(service);
    const panel = host.querySelector('[data-notifications-panel]') || document.createElement('aside');
    panel.className = 'notifications-center';
    panel.dataset.notificationsPanel = 'true';
    panel.dataset.open = service.getState().centerOpen ? 'true' : 'false';

    const unreadCount = host.querySelector('[data-notifications-unread]') || document.createElement('span');
    unreadCount.className = 'notifications-launcher__count';
    unreadCount.dataset.notificationsUnread = 'true';

    if (!unreadCount.isConnected) {
        launcher.appendChild(unreadCount);
    }

    if (!launcher.isConnected) {
        host.appendChild(launcher);
    }

    if (!panel.isConnected) {
        const header = createHeader(service);
        const status = document.createElement('p');
        status.className = 'notifications-center__status';
        status.dataset.notificationsStatus = 'true';

        const list = document.createElement('div');
        list.className = 'notifications-center__list';
        list.dataset.notificationsList = 'true';

        panel.appendChild(header);
        panel.appendChild(status);
        panel.appendChild(list);
        host.appendChild(panel);
    }

    if (!host.isConnected) {
        root.body.appendChild(host);
    }

    const list = panel.querySelector('[data-notifications-list]');
    const status = panel.querySelector('[data-notifications-status]');
    const onClick = (event) => {
        const actionButton = event.target.closest('[data-notifications-action]');
        if (actionButton) {
            const action = actionButton.dataset.notificationsAction;
            const id = actionButton.dataset.notificationId;
            if (action === 'mark-read' && id) {
                service.markRead(id, 'ui');
            } else if (action === 'remove' && id) {
                service.remove(id, 'ui');
            } else if (action === 'mark-all-read') {
                service.markAllRead('ui');
            } else if (action === 'clear') {
                service.clear('ui');
            } else if (action === 'close') {
                service.closeCenter('ui');
            }
            syncCenter(service, host, launcher, panel, unreadCount, list, status);
            return;
        }

        const launcherButton = event.target.closest('[data-notifications-launcher]');
        if (launcherButton) {
            service.openCenter('ui');
            syncCenter(service, host, launcher, panel, unreadCount, list, status);
        }
    };

    launcher.addEventListener('click', onClick);
    panel.addEventListener('click', onClick);

    const eventBus = service.eventBus;
    const subscriptions = [];
    const subscribe = (eventName, handler) => {
        const unsubscribe = eventBus?.subscribe?.(eventName, handler);
        if (unsubscribe) {
            subscriptions.push(unsubscribe);
        }
    };

    subscribe('NOTIFICATIONS_STATE_CHANGED', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATIONS_CENTER_OPENED', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATIONS_CENTER_CLOSED', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATION_ENQUEUED', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATION_READ', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATIONS_READ_ALL', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATION_REMOVED', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));
    subscribe('NOTIFICATIONS_CLEARED', () => syncCenter(service, host, launcher, panel, unreadCount, list, status));

    syncCenter(service, host, launcher, panel, unreadCount, list, status);

    return () => {
        launcher.removeEventListener('click', onClick);
        panel.removeEventListener('click', onClick);
        subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
        if (owned) {
            host.remove();
        }
    };
}
