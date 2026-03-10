const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `modal-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const localStack = [];
let modalSystemCleanup = null;
let previewButtonCleanups = [];

function getRuntime() {
    return window.csma || {};
}

function getModalService() {
    return getRuntime().modal;
}

function getEventBus() {
    return getRuntime().eventBus;
}

export function initModalSystemPattern() {
    modalSystemCleanup?.();

    const stackList = document.querySelector('[data-modal-stack]');
    const preview = document.querySelector('[data-modal-preview]');
    const cleanups = [];

    const renderPreview = (entry) => {
        previewButtonCleanups.splice(0).reverse().forEach((cleanup) => cleanup());

        if (!preview || !entry) {
            if (preview) {
                preview.dataset.visible = 'false';
            }
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
            const handleClick = () => closeModal(entry.id);
            btn.addEventListener('click', handleClick);
            previewButtonCleanups.push(() => btn.removeEventListener('click', handleClick));
        });
    };

    const renderStack = (stack = []) => {
        if (!stackList) return;
        stackList.innerHTML = '';

        if (!stack.length) {
            stackList.innerHTML = '<li class="csma-modal-empty">Stack empty — use buttons to push modals.</li>';
            if (preview) {
                preview.dataset.visible = 'false';
            }
            return;
        }

        stack.forEach((entry) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div>
                    <strong>${entry.title || 'Untitled modal'}</strong>
                    <div>${entry.modalType || 'default'} · ${entry.blocking ? 'blocking' : 'non-blocking'}</div>
                </div>
                <button class="button" data-variant="text" type="button">Close</button>
            `;
            const button = li.querySelector('button');
            const handleClick = () => closeModal(entry.id);
            button.addEventListener('click', handleClick);
            cleanups.push(() => button.removeEventListener('click', handleClick));
            stackList.appendChild(li);
        });

        renderPreview(stack.at(-1));
    };

    const openModal = (type) => {
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

        const modalService = getModalService();
        const eventBus = getEventBus();
        if (modalService?.open) {
            modalService.open(payload);
        } else if (eventBus?.publish) {
            eventBus.publish('INTENT_MODAL_OPEN', { ...payload, timestamp: Date.now() });
        } else {
            localStack.push({ id: uuid(), ...payload });
            renderStack(localStack);
        }
    };

    const closeModal = (id) => {
        const modalService = getModalService();
        const eventBus = getEventBus();

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
    };

    const closeAll = () => {
        const modalService = getModalService();
        const eventBus = getEventBus();

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
    };

    document.querySelectorAll('[data-modal-open]').forEach((btn) => {
        const handleClick = () => openModal(btn.dataset.modalOpen);
        btn.addEventListener('click', handleClick);
        cleanups.push(() => btn.removeEventListener('click', handleClick));
    });

    const closeTopButton = document.querySelector('[data-modal-close-top]');
    if (closeTopButton) {
        const handleClick = () => closeModal();
        closeTopButton.addEventListener('click', handleClick);
        cleanups.push(() => closeTopButton.removeEventListener('click', handleClick));
    }

    const closeAllButton = document.querySelector('[data-modal-close-all]');
    if (closeAllButton) {
        const handleClick = () => closeAll();
        closeAllButton.addEventListener('click', handleClick);
        cleanups.push(() => closeAllButton.removeEventListener('click', handleClick));
    }

    const eventBus = getEventBus();
    if (eventBus?.subscribe) {
        cleanups.push(eventBus.subscribe('MODAL_STACK_UPDATED', ({ stack }) => renderStack(stack)));
    } else {
        renderStack(localStack);
    }

    modalSystemCleanup = () => {
        previewButtonCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
        modalSystemCleanup = null;
    };

    return modalSystemCleanup;
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

if (typeof window !== 'undefined') {
    modalSystemCleanup = initModalSystemPattern();
}
