/**
 * DevPanel - Development tools panel
 * Only loaded in development mode - 0KB in production!
 */
import { LifecycleScope } from '../LifecycleScope.js';

export class DevPanel {
    constructor(logAccumulator) {
        this.logAccumulator = logAccumulator;
        this.eventBus = logAccumulator.eventBus;
        this.panel = null;
        this.channelManager = window.csma?.channels || null;
        this.optimisticEvents = [];
        this.optimisticActions = [];
        this.lifecycle = new LifecycleScope('DevPanel');
        this.originalPublish = null;
        this.domReadyHandler = this.create.bind(this);
        this.resizeDragCleanup = null;
        this.destroyed = false;

        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            this.lifecycle.listen(document, 'DOMContentLoaded', this.domReadyHandler, { once: true });
        } else {
            this.create();
        }
    }

    create() {
        if (this.panel || this.destroyed) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'csma-devtools';
        panel.className = 'csma-devtools collapsed';

        const toggle = document.createElement('div');
        toggle.className = 'devtools-toggle';
        toggle.textContent = '🛠️ CSMA DevTools';

        const content = document.createElement('div');
        content.className = 'devtools-content';

        const header = document.createElement('div');
        header.className = 'devtools-header';
        const title = document.createElement('h3');
        title.textContent = 'CSMA Developer Tools';
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'devtools-minimize';
        minimizeBtn.type = 'button';
        minimizeBtn.setAttribute('aria-label', 'Minimize DevTools');
        minimizeBtn.textContent = '—';
        header.append(title, minimizeBtn);

        const tabs = document.createElement('div');
        tabs.className = 'devtools-tabs';
        tabs.innerHTML = `
            <button class="button devtools-tab active" data-variant="ghost" data-tab="events">Events</button>
            <button class="button devtools-tab" data-variant="ghost" data-tab="errors">Errors</button>
            <button class="button devtools-tab" data-variant="ghost" data-tab="contracts">Contracts</button>
            <button class="button devtools-tab" data-variant="ghost" data-tab="optimistic">Optimistic</button>
            <button class="button devtools-tab" data-variant="ghost" data-tab="analytics">Analytics</button>
        `;

        const toolbar = document.createElement('div');
        toolbar.className = 'devtools-toolbar';
        toolbar.innerHTML = `
            <button id="devtools-clear" class="button devtools-action" data-variant="outline">Clear</button>
            <button id="devtools-copy" class="button devtools-action" data-variant="outline">Copy Logs</button>
            <button id="devtools-export" class="button devtools-action" data-variant="outline">Export .txt</button>
            <input type="search" placeholder="Filter..." class="devtools-filter">
        `;

        const body = document.createElement('div');
        body.className = 'devtools-body';
        body.id = 'devtools-body';

        content.append(header, tabs, toolbar, body);
        panel.append(toggle, content);
        const resizer = document.createElement('div');
        resizer.className = 'devtools-resizer';
        panel.appendChild(resizer);
        document.body.appendChild(panel);
        this.panel = panel;
        this.actionLogService = window.csma?.actionLog || null;
        this.channelManager = window.csma?.channels || this.channelManager;

        // Setup event listeners
        this.setupListeners();

        // Subscribe to all events
        this.subscribeToEvents();
        this.subscribeToOptimisticEvents();

        // Initial render
        this.render('events');

        // Inject styles
        this.injectStyles();
    }

    setupListeners() {
        const toggle = this.panel.querySelector('.devtools-toggle');
        const handleToggleClick = () => {
            this.panel.classList.toggle('collapsed');
        };
        this.lifecycle.listen(toggle, 'click', handleToggleClick);

        const minimizeBtn = this.panel.querySelector('.devtools-minimize');
        const handleMinimizeClick = () => {
            this.panel.classList.toggle('collapsed');
            if (this.panel.classList.contains('collapsed')) {
                this.panel.dataset.prevWidth = this.panel.style.width;
                this.panel.dataset.prevHeight = this.panel.style.height;
                this.panel.style.width = '';
                this.panel.style.height = '';
            } else {
                this.panel.style.width = this.panel.dataset.prevWidth || this.panel.style.width;
                this.panel.style.height = this.panel.dataset.prevHeight || this.panel.style.height;
            }
        };
        this.lifecycle.listen(minimizeBtn, 'click', handleMinimizeClick);

        // Tab switching
        this.panel.querySelectorAll('.devtools-tab').forEach(btn => {
            const handleTabClick = () => {
                this.panel.querySelectorAll('.devtools-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.render(btn.dataset.tab);
            };
            this.lifecycle.listen(btn, 'click', handleTabClick);
        });

        // Clear button
        this.lifecycle.listen(this.panel.querySelector('#devtools-clear'), 'click', () => {
            this.panel.querySelector('.devtools-body').innerHTML = '';
        });

        // Copy button
        this.lifecycle.listen(this.panel.querySelector('#devtools-copy'), 'click', () => {
            navigator.clipboard.writeText(JSON.stringify(this.logAccumulator.logs, null, 2));
        });

        // Export button
        this.lifecycle.listen(this.panel.querySelector('#devtools-export'), 'click', () => {
            const blob = new Blob([
                this.logAccumulator.logs.map((entry) => JSON.stringify(entry)).join('\n')
            ], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `csma-logs-${Date.now()}.txt`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);
        });

        // Filter
        this.lifecycle.listen(this.panel.querySelector('.devtools-filter'), 'input', () => {
            const activeTab = this.panel.querySelector('.devtools-tab.active')?.dataset.tab;
            if (activeTab) {
                this.render(activeTab);
            }
        });

        this.setupResizer();
    }

    setupResizer() {
        const resizer = this.panel.querySelector('.devtools-resizer');
        if (!resizer) return;
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;

        const onMouseMove = (event) => {
            const deltaX = startX - event.clientX;
            const deltaY = startY - event.clientY;
            const newWidth = Math.max(320, startWidth + deltaX);
            const newHeight = Math.max(240, startHeight + deltaY);
            this.panel.style.width = `${newWidth}px`;
            this.panel.style.height = `${newHeight}px`;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            this.resizeDragCleanup = null;
        };

        const handleMouseDown = (event) => {
            event.preventDefault();
            startX = event.clientX;
            startY = event.clientY;
            startWidth = this.panel.getBoundingClientRect().width;
            startHeight = this.panel.getBoundingClientRect().height;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            this.resizeDragCleanup = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                this.resizeDragCleanup = null;
            };
            this.panel.classList.remove('collapsed');
        };

        this.lifecycle.listen(resizer, 'mousedown', handleMouseDown);
    }

    subscribeToEvents() {
        // Subscribe to all events
        if (this.originalPublish) {
            return;
        }

        this.originalPublish = this.eventBus.publish.bind(this.eventBus);
        this.eventBus.publish = (eventName, payload) => {
            // Log event (except LOG_ENTRY to avoid recursion)
            if (eventName !== 'LOG_ENTRY') {
                this.logAccumulator.log('event', { eventName, payload });
            }
            return this.originalPublish(eventName, payload);
        };
    }

    subscribeToOptimisticEvents() {
        if (!this.eventBus) return;
        const rerender = () => {
            const activeTab = this.panel?.querySelector('.devtools-tab.active')?.dataset.tab;
            if (activeTab === 'optimistic') {
                this.render('optimistic');
            }
        };
        ['OPTIMISTIC_ACTION_RECORDED', 'OPTIMISTIC_ACTION_ACKED', 'OPTIMISTIC_ACTION_FAILED', 'OPTIMISTIC_LOG_UPDATED', 'OPTIMISTIC_TRANSPORT_REPLAY']
            .forEach((eventName) => this.lifecycle.subscribe(this.eventBus, eventName, (payload) => {
                this.captureOptimisticAction(eventName, payload);
                rerender();
            }));
        ['CHANNEL_SUBSCRIBED', 'CHANNEL_UNSUBSCRIBED', 'CHANNEL_ACCESS_REVOKED']
            .forEach((eventName) => this.lifecycle.subscribe(this.eventBus, eventName, rerender));

        const capture = (type) => (payload) => {
            this.captureOptimisticEvent(type, payload);
            rerender();
        };

        this.lifecycle.subscribe(this.eventBus, 'OPTIMISTIC_SERVER_REWORK', capture('server-rework'));
        this.lifecycle.subscribe(this.eventBus, 'CHANNEL_SERVER_EVENT', capture('channel-event'));
        this.lifecycle.subscribe(this.eventBus, 'CHANNEL_SERVER_INVALIDATE', capture('channel-invalidate'));
        this.lifecycle.subscribe(this.eventBus, 'CHANNEL_ACCESS_DENIED', capture('channel-access-denied'));
        this.lifecycle.subscribe(this.eventBus, 'OPTIMISTIC_SERVER_REPLAY', capture('server-replay'));

        this.lifecycle.subscribe(this.eventBus, 'MODULE_LOADED', () => {
            if (!this.actionLogService) {
                this.actionLogService = window.serviceManager?.get('actionLog') || window.csma?.actionLog || null;
            }
            if (!this.channelManager) {
                this.channelManager = window.serviceManager?.get('channels') || window.csma?.channels || this.channelManager;
            }
        });
        this.lifecycle.subscribe(this.eventBus, 'OPTIMISTIC_LOG_READY', () => {
            this.actionLogService = window.serviceManager?.get('actionLog') || window.csma?.actionLog || this.actionLogService;
            rerender();
        });
    }

    captureOptimisticEvent(type, payload) {
        this.optimisticEvents = [
            { type, payload, timestamp: Date.now() },
            ...this.optimisticEvents
        ].slice(0, 40);
    }

    captureOptimisticAction(eventName, payload) {
        if (!payload) {
            return;
        }
        const status = eventName === 'OPTIMISTIC_ACTION_ACKED'
            ? 'acked'
            : eventName === 'OPTIMISTIC_ACTION_FAILED'
                ? 'failed'
                : 'recorded';
        this.optimisticActions = [
            {
                status,
                intent: payload?.entry?.intent || payload?.intent || 'unknown',
                entryId: payload?.entry?.id || null,
                timestamp: Date.now()
            },
            ...this.optimisticActions
        ].slice(0, 30);
    }

    update(entry) {
        if (!this.panel) return;

        const activeTab = this.panel.querySelector('.devtools-tab.active')?.dataset.tab;
        if (!activeTab) return;

        // Only update if entry matches active tab
        const matchesTab =
            (activeTab === 'events' && entry.type === 'event') ||
            (activeTab === 'errors' && ['error', 'promise-error'].includes(entry.type)) ||
            (activeTab === 'contracts' && entry.type === 'contract-violation') ||
            (activeTab === 'analytics');

        if (matchesTab) {
            this.render(activeTab);
        }
    }

    render(tab) {
        if (!this.panel) return;

        const body = this.panel.querySelector('#devtools-body');
        const filter = this.panel.querySelector('.devtools-filter').value.toLowerCase();

        let entries = this.logAccumulator.logs.slice(-100).reverse(); // Last 100 entries

        // Filter by tab
        if (tab === 'optimistic') {
            body.innerHTML = this.renderOptimisticEntries(filter);
            return;
        }

        if (tab === 'events') {
            entries = entries.filter(e => e.type === 'event');
        } else if (tab === 'errors') {
            entries = entries.filter(e => ['error', 'promise-error'].includes(e.type));
        } else if (tab === 'contracts') {
            entries = entries.filter(e => e.type === 'contract-violation');
        }

        // Filter by search
        if (filter) {
            entries = entries.filter(e =>
                JSON.stringify(e).toLowerCase().includes(filter)
            );
        }

        body.innerHTML = entries.map(entry => this.renderEntry(entry)).join('');
    }

    renderEntry(entry) {
        const time = new Date(entry.timestamp).toLocaleTimeString();
        const typeClass = entry.type.replace('-', '_');

        return `
            <div class="log-entry log-${typeClass}">
                <span class="log-time">${time}</span>
                <span class="log-type">${entry.type}</span>
                <pre class="log-data">${JSON.stringify(entry.data, null, 2)}</pre>
            </div>
        `;
    }

    renderOptimisticEntries(filter) {
        const sections = [];
        sections.push(this.renderChannelSubscriptions(filter));
        sections.push(this.renderOptimisticEventFeed(filter));
        sections.push(this.renderOptimisticActionHistory(filter));
        sections.push(this.renderActionLogEntries(filter));
        return sections.filter(Boolean).join('');
    }

    renderOptimisticActionHistory(filter) {
        if (!this.optimisticActions.length) {
            return '';
        }
        const lowered = filter ? filter.toLowerCase() : '';
        let entries = this.optimisticActions;
        if (lowered) {
            entries = entries.filter((entry) =>
                JSON.stringify(entry).toLowerCase().includes(lowered)
            );
        }
        if (!entries.length) {
            return '';
        }
        return `
            <section class="log-section">
                <div class="log-section-title">Recent Actions</div>
                ${entries.map((entry) => `
                    <div class="log-entry log-optimistic">
                        <div class="log-row">
                            <span class="log-time">${new Date(entry.timestamp).toLocaleTimeString()}</span>
                            <span class="log-type">${entry.status}</span>
                        </div>
                        <div class="log-row">
                            <span class="log-type">${entry.intent}</span>
                            ${entry.entryId ? `<span class="log-type">${entry.entryId.slice(0, 8)}…</span>` : ''}
                        </div>
                    </div>
                `).join('')}
            </section>
        `;
    }

    renderChannelSubscriptions(filter) {
        const manager = this.channelManager || window.serviceManager?.get?.('channels') || window.csma?.channels;
        if (!manager?.listSubscriptions) {
            return '<p class="log-entry">Channel manager not available.</p>';
        }
        let subs = manager.listSubscriptions();
        const lowered = filter ? filter.toLowerCase() : '';
        if (lowered) {
            subs = subs.filter((sub) => JSON.stringify(sub).toLowerCase().includes(lowered));
        }
        if (subs.length === 0) {
            return '<p class="log-entry">No active channel subscriptions.</p>';
        }
        return `
            <section class="log-section">
                <div class="log-section-title">Channel Subscriptions</div>
                ${subs.map((sub) => `
                    <div class="log-entry log-channel">
                        <div class="log-row">
                            <span class="log-type">${sub.id}</span>
                            <span class="log-type">${JSON.stringify(sub.params || {})}</span>
                        </div>
                    </div>
                `).join('')}
            </section>
        `;
    }

    renderOptimisticEventFeed(filter) {
        const lowered = filter ? filter.toLowerCase() : '';
        let events = this.optimisticEvents;
        if (lowered) {
            events = events.filter((entry) => JSON.stringify(entry).toLowerCase().includes(lowered));
        }
        if (events.length === 0) {
            return '';
        }
        return `
            <section class="log-section">
                <div class="log-section-title">Server Events</div>
                ${events.map((event) => `
                    <div class="log-entry log-event">
                        <div class="log-row">
                            <span class="log-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                            <span class="log-type">${event.type}</span>
                        </div>
                        <pre class="log-data">${JSON.stringify(event.payload, null, 2)}</pre>
                    </div>
                `).join('')}
            </section>
        `;
    }

    renderActionLogEntries(filter) {
        if (!this.actionLogService) {
            return '<p class="log-entry">Optimistic sync module is not enabled.</p>';
        }

        let entries = this.actionLogService.getAll().slice().sort((a, b) => b.createdAt - a.createdAt);
        const lowered = filter ? filter.toLowerCase() : '';
        if (lowered) {
            entries = entries.filter(entry => JSON.stringify(entry).toLowerCase().includes(lowered));
        }

        if (entries.length === 0) {
            return '<p class="log-entry">No optimistic actions recorded.</p>';
        }

        return `
            <section class="log-section">
                <div class="log-section-title">Action Log</div>
                ${entries.map(entry => {
                    const created = new Date(entry.createdAt).toLocaleTimeString();
                    const reasons = (entry.meta?.reasons || []).join(', ');
                    const channels = (entry.meta?.channels || ['global']).join(', ');
                    return `
                        <div class="log-entry log-optimistic">
                            <div class="log-row">
                                <span class="log-time">${created}</span>
                                <span class="log-type">${entry.status.toUpperCase()}</span>
                                <span class="log-type">${entry.intent}</span>
                                <span class="log-type">attempts: ${entry.attempts || 0}</span>
                                <span class="log-type">channels: ${channels}</span>
                                <span class="log-type">reasons: ${reasons || '—'}</span>
                            </div>
                            <pre class="log-data">${JSON.stringify(entry.payload, null, 2)}</pre>
                            ${entry.lastError ? `<pre class="log-data error">${entry.lastError}</pre>` : ''}
                        </div>
                    `;
                }).join('')}
            </section>
        `;
    }

    injectStyles() {
        // Respect CSP: use external stylesheet instead of inline <style>
        const existing = document.querySelector('link[data-devpanel-style]');
        if (existing) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/src/runtime/devtools/devpanel.css';
        link.dataset.devpanelStyle = 'true';
        document.head.appendChild(link);
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        if (this.originalPublish) {
            this.eventBus.publish = this.originalPublish;
            this.originalPublish = null;
        }

        this.resizeDragCleanup?.();
        this.resizeDragCleanup = null;
        this.lifecycle.destroy();
        this.panel?.remove();
        this.panel = null;
    }
}
