import './analytics-consent.css';

const SCOPES = ['ui_analytics', 'performance', 'error_tracking', 'security'];

function statusText(service) {
    const scopes = service.getAllScopes();
    const enabled = Object.entries(scopes).filter(([, value]) => value).map(([key]) => key);
    return enabled.length ? `Enabled: ${enabled.join(', ')}` : 'All optional telemetry disabled';
}

function ensureModal(container) {
    let modal = container.querySelector('[data-consent-modal]');
    if (modal) {
        return modal;
    }

    modal = document.createElement('div');
    modal.className = 'analytics-consent-modal';
    modal.dataset.consentModal = 'true';
    modal.dataset.open = 'false';

    const panel = document.createElement('div');
    panel.className = 'analytics-consent-panel';

    const title = document.createElement('h3');
    title.textContent = 'Telemetry Preferences';
    panel.appendChild(title);

    const status = document.createElement('p');
    status.dataset.consentStatus = 'true';
    panel.appendChild(status);

    const scopes = document.createElement('div');
    scopes.className = 'analytics-consent-scopes';
    SCOPES.forEach((scope) => {
        const row = document.createElement('label');
        row.className = 'analytics-consent-scope';
        row.innerHTML = `
            <span>${scope}</span>
            <input type="checkbox" data-consent-toggle="${scope}">
        `;
        scopes.appendChild(row);
    });
    panel.appendChild(scopes);

    const actions = document.createElement('div');
    actions.className = 'analytics-consent-actions';
    actions.innerHTML = `
        <button type="button" data-consent-accept>Accept all</button>
        <button type="button" data-consent-close>Close</button>
        <button type="button" data-consent-clear>Clear telemetry</button>
    `;
    panel.appendChild(actions);
    modal.appendChild(panel);
    container.appendChild(modal);
    return modal;
}

export function initAnalyticsConsentUI(service, root = document) {
    const containers = Array.from(root.querySelectorAll('[data-consent-center]'));
    if (containers.length === 0 || !service) {
        return () => {};
    }

    const cleanups = [];
    const syncContainer = (container) => {
        const modal = ensureModal(container);
        const status = container.querySelector('[data-consent-status]') || modal.querySelector('[data-consent-status]');
        const setOpen = (value) => {
            modal.dataset.open = value ? 'true' : 'false';
        };

        const syncState = () => {
            SCOPES.forEach((scope) => {
                const input = modal.querySelector(`[data-consent-toggle="${scope}"]`);
                if (input) {
                    input.checked = service.getConsent(scope);
                }
            });
            if (status) {
                status.textContent = statusText(service);
            }
        };

        syncState();
        setOpen(!service.wasAcknowledged());

        const openTrigger = container.querySelector('[data-consent-open]');
        if (openTrigger) {
            const onOpen = () => setOpen(true);
            openTrigger.addEventListener('click', onOpen);
            cleanups.push(() => openTrigger.removeEventListener('click', onOpen));
        }

        modal.querySelectorAll('[data-consent-toggle]').forEach((input) => {
            const onChange = () => {
                service.setConsent(input.dataset.consentToggle, input.checked);
                syncState();
            };
            input.addEventListener('change', onChange);
            cleanups.push(() => input.removeEventListener('change', onChange));
        });

        const acceptButton = modal.querySelector('[data-consent-accept]');
        const onAccept = () => {
            service.acceptAll();
            syncState();
            setOpen(false);
        };
        acceptButton?.addEventListener('click', onAccept);
        cleanups.push(() => acceptButton?.removeEventListener('click', onAccept));

        const closeButton = modal.querySelector('[data-consent-close]');
        const onClose = () => {
            service.acknowledge();
            syncState();
            setOpen(false);
        };
        closeButton?.addEventListener('click', onClose);
        cleanups.push(() => closeButton?.removeEventListener('click', onClose));

        const clearButton = modal.querySelector('[data-consent-clear]');
        const onClear = () => {
            service.clearTelemetry();
            syncState();
        };
        clearButton?.addEventListener('click', onClear);
        cleanups.push(() => clearButton?.removeEventListener('click', onClear));
    };

    containers.forEach(syncContainer);

    return () => {
        cleanups.forEach((cleanup) => cleanup());
    };
}
