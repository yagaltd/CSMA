const csma = window.csma || {};
const modalService = csma.modal;
const eventBus = csma.eventBus;
const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `modal-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const localStack = [];

const stackList = document.querySelector('[data-modal-stack]');
const preview = document.querySelector('[data-modal-preview]');

function init() {
    const openButtons = document.querySelectorAll('[data-modal-open]');
    openButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.modalOpen;
            openModal(type);
        });
    });

    document.querySelector('[data-modal-close-top]').addEventListener('click', () => closeModal());
    document.querySelector('[data-modal-close-all]').addEventListener('click', () => closeAll());

    if (eventBus?.subscribe) {
        eventBus.subscribe('MODAL_STACK_UPDATED', ({ stack }) => renderStack(stack));
    } else {
        renderStack(localStack);
    }
}

function openModal(type) {
    const payload = {
        title: type === 'confirm' ? 'Confirm action' : type === 'success' ? 'Success' : 'Informational modal',
        component: `demo-${type}-modal`,
        modalType: type,
        blocking: type === 'confirm',
        props: {
            message: getMessage(type),
            timestamp: new Date().toLocaleTimeString()
        }
    };

    if (modalService?.open) {
        modalService.open(payload);
    } else if (eventBus?.publish) {
        eventBus.publish('INTENT_MODAL_OPEN', { ...payload, timestamp: Date.now() });
    } else {
        localStack.push({ id: uuid(), ...payload });
        renderStack(localStack);
    }
}

function closeModal(id) {
    if (modalService?.close) {
        modalService.close(id);
        return;
    }
    if (eventBus?.publish) {
        eventBus.publish('INTENT_MODAL_CLOSE', { id, timestamp: Date.now() });
        return;
    }
    if (localStack.length) {
        localStack.pop();
        renderStack(localStack);
    }
}

function closeAll() {
    if (modalService?.closeAll) {
        modalService.closeAll();
        return;
    }
    if (eventBus?.publish) {
        eventBus.publish('INTENT_MODAL_CLOSE_ALL', { timestamp: Date.now() });
        return;
    }
    localStack.length = 0;
    renderStack(localStack);
}

function renderStack(stack = []) {
    if (!stackList) return;
    stackList.innerHTML = '';

    if (!stack.length) {
        stackList.innerHTML = '<li class="csma-modal-empty">Stack empty — use buttons to push modals.</li>';
        preview.dataset.visible = 'false';
        return;
    }

    stack.forEach((entry, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${entry.title || 'Untitled modal'}</strong>
                <div>${entry.modalType || 'default'} · ${entry.blocking ? 'blocking' : 'non-blocking'}</div>
            </div>
            <button class="button" data-variant="text" type="button">Close</button>
        `;
        li.querySelector('button').addEventListener('click', () => closeModal(entry.id));
        stackList.appendChild(li);
    });

    const top = stack.at(-1);
    renderPreview(top);
}

function renderPreview(entry) {
    if (!preview || !entry) {
        preview.dataset.visible = 'false';
        return;
    }
    preview.dataset.visible = 'true';
    preview.innerHTML = `
        <div class="csma-modal-preview-card">
            <header>
                <div>
                    <div class="csma-modal-chip">${entry.modalType}</div>
                    <h3>${entry.title}</h3>
                </div>
                <button class="button" data-variant="ghost" data-shape="icon" aria-label="Close" data-close-preview>✕</button>
            </header>
            <p>${entry.props?.message || 'This is a CSMA modal. Use it for confirmations, flows, or announcements.'}</p>
            <div class="csma-modal-actions" style="margin-top: var(--spacing-lg);">
                <button class="button" data-variant="secondary" type="button" data-close-preview>Maybe later</button>
                <button class="button" data-variant="primary" type="button">Continue</button>
            </div>
        </div>
    `;
    preview.querySelectorAll('[data-close-preview]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(entry.id));
    });
}

function getMessage(type) {
    switch (type) {
        case 'confirm':
            return 'Please confirm this irreversible action.';
        case 'success':
            return 'Everything looks good! This is a success modal.';
        case 'info':
        default:
            return 'Use modals sparingly to avoid interrupting users.';
    }
}

init();
