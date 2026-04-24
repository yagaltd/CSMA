import './consent-ui.css';

const CATEGORY_ORDER = ['essential', 'preferences', 'analytics', 'performance', 'marketing'];

function setOpen(element, value) {
    if (element) {
        element.dataset.open = value ? 'true' : 'false';
    }
}

function appendTextElement(parent, tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text || '';
    parent.appendChild(element);
    return element;
}

function createButton(label, variant, action) {
    const button = document.createElement('button');
    button.className = 'button';
    button.dataset.variant = variant;
    button.dataset.consentAction = action;
    button.type = 'button';
    button.textContent = label;
    return button;
}

function createActions(copy) {
    const actions = document.createElement('div');
    actions.className = 'consent-actions';
    actions.appendChild(createButton(copy.acceptAll, 'primary', 'accept-all'));
    actions.appendChild(createButton(copy.rejectOptional, 'outline', 'reject-optional'));
    actions.appendChild(createButton(copy.customize, 'ghost', 'customize'));
    return actions;
}

function createBanner(service) {
    const state = service.getState();
    const banner = document.createElement('section');
    banner.className = 'consent-banner';
    banner.dataset.consentBanner = 'true';
    banner.dataset.open = 'false';
    banner.setAttribute('aria-label', state.copy.title);

    const content = document.createElement('div');
    content.className = 'consent-banner__content';
    appendTextElement(content, 'h2', 'consent-banner__title', state.copy.title);
    appendTextElement(content, 'p', 'consent-banner__description', state.copy.description);
    banner.appendChild(content);
    banner.appendChild(createActions(state.copy));
    return banner;
}

function createCategoryRow(service, category) {
    const state = service.getState();
    const row = document.createElement('label');
    row.className = 'consent-category';
    row.dataset.consentCategory = category;

    const copy = document.createElement('span');
    copy.className = 'consent-category__copy';
    appendTextElement(copy, 'span', 'consent-category__label', state.categoryLabels[category] || category);
    appendTextElement(copy, 'span', 'consent-category__description', state.categoryDescriptions[category] || '');

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.consentToggle = category;
    input.checked = service.hasConsent(category);

    if (category === 'essential') {
        input.checked = true;
        input.disabled = true;
        appendTextElement(copy, 'span', 'consent-category__lock', state.copy.essentialLocked);
    }

    row.appendChild(copy);
    row.appendChild(input);
    return row;
}

function createModal(service) {
    const state = service.getState();
    const modal = document.createElement('div');
    modal.className = 'consent-modal';
    modal.dataset.consentModal = 'true';
    modal.dataset.open = 'false';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', state.copy.title);

    const panel = document.createElement('div');
    panel.className = 'consent-modal__panel';

    const header = document.createElement('header');
    header.className = 'consent-modal__header';
    appendTextElement(header, 'h2', 'consent-modal__title', state.copy.title);
    appendTextElement(header, 'p', 'consent-modal__description', state.copy.description);
    appendTextElement(header, 'p', 'consent-status', '');
    panel.appendChild(header);

    const categories = document.createElement('div');
    categories.className = 'consent-categories';
    CATEGORY_ORDER.forEach((category) => categories.appendChild(createCategoryRow(service, category)));
    panel.appendChild(categories);

    const actions = document.createElement('div');
    actions.className = 'consent-actions';
    actions.appendChild(createButton(state.copy.save, 'primary', 'save'));
    actions.appendChild(createButton(state.copy.acceptAll, 'outline', 'accept-all'));
    actions.appendChild(createButton(state.copy.rejectOptional, 'ghost', 'reject-optional'));
    actions.appendChild(createButton(state.copy.close, 'ghost', 'close'));
    panel.appendChild(actions);

    modal.appendChild(panel);
    return modal;
}

function statusText(service) {
    const categories = service.getAllCategories();
    const enabled = Object.entries(categories)
        .filter(([, value]) => value)
        .map(([key]) => key);
    return enabled.length ? `Enabled: ${enabled.join(', ')}` : 'Only essential features are enabled';
}

export function initConsentUI(service, root = document) {
    if (!service || !root?.body) {
        return () => {};
    }

    const host = root.querySelector('[data-consent-center]') || root.body;
    const banner = host.querySelector('[data-consent-banner]') || createBanner(service);
    const modal = host.querySelector('[data-consent-modal]') || createModal(service);
    const cleanups = [];

    if (!banner.isConnected) {
        host.appendChild(banner);
    }
    if (!modal.isConnected) {
        host.appendChild(modal);
    }

    const syncState = () => {
        CATEGORY_ORDER.forEach((category) => {
            modal.querySelectorAll(`[data-consent-toggle="${category}"]`).forEach((input) => {
                input.checked = service.hasConsent(category);
            });
        });
        modal.querySelectorAll('.consent-status').forEach((status) => {
            status.textContent = statusText(service);
        });
        root.querySelectorAll('[data-consent-status]').forEach((status) => {
            status.textContent = statusText(service);
        });
        setOpen(banner, !service.wasAcknowledged());
    };

    const savePreferences = () => {
        modal.querySelectorAll('[data-consent-toggle]').forEach((input) => {
            service.setConsent(input.dataset.consentToggle, input.checked, 'ui');
        });
        service.acknowledge('ui');
        syncState();
        setOpen(modal, false);
    };

    const onClick = (event) => {
        const action = event.target.closest('[data-consent-action]')?.dataset.consentAction;
        if (!action) {
            return;
        }

        if (action === 'customize') {
            syncState();
            setOpen(modal, true);
        } else if (action === 'accept-all') {
            service.acceptAll('ui');
            syncState();
            setOpen(modal, false);
        } else if (action === 'reject-optional') {
            service.rejectOptional('ui');
            syncState();
            setOpen(modal, false);
        } else if (action === 'save') {
            savePreferences();
        } else if (action === 'close') {
            service.acknowledge('ui');
            syncState();
            setOpen(modal, false);
        }
    };

    const openTrigger = root.querySelector('[data-consent-open]');
    if (openTrigger) {
        const onOpen = () => {
            syncState();
            setOpen(modal, true);
        };
        openTrigger.addEventListener('click', onOpen);
        cleanups.push(() => openTrigger.removeEventListener('click', onOpen));
    }

    banner.addEventListener('click', onClick);
    modal.addEventListener('click', onClick);
    cleanups.push(() => banner.removeEventListener('click', onClick));
    cleanups.push(() => modal.removeEventListener('click', onClick));

    syncState();

    return () => {
        cleanups.forEach((cleanup) => cleanup());
        if (banner.dataset.consentBanner === 'true') {
            banner.remove();
        }
        if (modal.dataset.consentModal === 'true') {
            modal.remove();
        }
    };
}
