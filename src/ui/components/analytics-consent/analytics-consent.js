export function initAnalyticsConsentControls() {
    const consentService = window.csma?.analyticsConsent;
    if (!consentService) {
        return () => {};
    }

    const cleanups = [];
    document.querySelectorAll('[data-consent-center], [data-consent-modal]').forEach((container) => {
        cleanups.push(setupConsentContainer(container, consentService));
    });

    document.querySelectorAll('[data-consent-open]').forEach((trigger) => {
        const targetSelector = trigger.dataset.consentOpen;
        const modal = targetSelector ? document.querySelector(targetSelector) : document.querySelector('[data-consent-modal]');
        if (!modal) return;
        trigger.addEventListener('click', () => openModal(modal));
    });

    return () => {
        cleanups.forEach((cleanup) => cleanup());
    };
}

function setupConsentContainer(container, consentService) {
    const toggles = Array.from(container.querySelectorAll('[data-consent-toggle]'));
    const statusEl = container.querySelector('[data-consent-status]');
    const clearButton = container.querySelector('[data-consent-clear]');
    const acceptButton = container.querySelector('[data-consent-accept]');
    const closeButton = container.querySelector('[data-consent-close]');
    const scopeDescriptions = new Map();

    toggles.forEach((toggle) => {
        const scope = toggle.dataset.consentToggle;
        if (!scope) return;
        toggle.checked = consentService.getConsent(scope);
        scopeDescriptions.set(scope, toggle.dataset.consentLabel || scope);
        toggle.addEventListener('change', () => {
            consentService.setConsent(scope, toggle.checked);
            updateStatus();
        });
    });

    clearButton?.addEventListener('click', () => {
        consentService.clearTelemetry();
        toggles.forEach((toggle) => {
            toggle.checked = false;
            consentService.setConsent(toggle.dataset.consentToggle, false);
        });
        consentService.acknowledge?.();
        updateStatus();
        container.dataset.state = 'cleared';
        window.setTimeout(() => {
            delete container.dataset.state;
        }, 2000);
        const modal = container.closest('[data-consent-modal]');
        if (modal) {
            closeModal(modal);
        }
    });

    acceptButton?.addEventListener('click', () => {
        if (!hasSelection()) return;
        closeModal(container.closest('[data-consent-modal]'));
    });

    closeButton?.addEventListener('click', () => {
        closeModal(container.closest('[data-consent-modal]'));
    });

    function hasSelection() {
        return toggles.some((toggle) => toggle.checked);
    }

    function updateStatus() {
        const enabledLabels = toggles
            .filter((toggle) => toggle.checked)
            .map((toggle) => scopeDescriptions.get(toggle.dataset.consentToggle) || toggle.dataset.consentToggle);

        if (statusEl) {
            statusEl.textContent = enabledLabels.length
                ? `Enabled: ${enabledLabels.join(', ')}`
                : 'No optional analytics are enabled';
        }

        const disableAccept = !enabledLabels.length;
        if (acceptButton) {
            acceptButton.disabled = disableAccept;
        }
        if (clearButton) {
            clearButton.disabled = false;
        }
    }

    updateStatus();

    return () => {
        toggles.forEach((toggle) => {
            const clone = toggle.cloneNode(true);
            toggle.parentNode?.replaceChild(clone, toggle);
        });
        [clearButton, acceptButton, closeButton].forEach((btn) => {
            if (btn) {
                const clone = btn.cloneNode(true);
                btn.parentNode?.replaceChild(clone, btn);
            }
        });
    };
}

function openModal(modal) {
    if (!modal) return;
    modal.dataset.open = 'true';
}

function closeModal(modal) {
    if (!modal) return;
    delete modal.dataset.open;
}
