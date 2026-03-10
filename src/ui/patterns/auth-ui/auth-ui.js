const csma = window.csma || {};

let authUICleanup = null;

export function initAuthUIPattern() {
    authUICleanup?.();

    const authUI = window.csma?.authUI || csma.authUI;
    const eventBus = window.csma?.eventBus || csma.eventBus;
    const statusEl = document.querySelector('[data-auth-status]');
    const logEl = document.querySelector('[data-auth-log]');
    const forms = Array.from(document.querySelectorAll('[data-auth-form]'));
    const toggleButtons = Array.from(document.querySelectorAll('[data-auth-view]'));
    const container = document.querySelector('[data-auth-container]');
    const cleanups = [];

    const setStatus = (state, message) => {
        if (!statusEl) return;
        statusEl.dataset.state = state;
        statusEl.textContent = message || `Status: ${state}`;
    };

    const appendLog = (text) => {
        if (!logEl) return;
        const entry = document.createElement('div');
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
        logEl.prepend(entry);
    };

    const switchView = (view) => {
        if (container) {
            container.dataset.view = view;
        }
        toggleButtons.forEach((btn) => {
            const isActive = btn.dataset.authView === view;
            btn.dataset.variant = isActive ? 'primary' : 'secondary';
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        forms.forEach((form) => {
            form.hidden = form.dataset.authForm !== view;
        });
    };

    const submitAuth = async (mode, values) => {
        setStatus('loading', `${mode} in progress...`);

        if (authUI?.submit) {
            const result = await authUI.submit({ mode, values });
            if (result.success) {
                setStatus('success', `${mode} completed`);
                appendLog(`${mode} succeeded via AuthUI service.`);
            } else if (result.error) {
                setStatus('error', result.error.message || result.error);
            }
            return;
        }

        if (eventBus?.publish) {
            await eventBus.publish('INTENT_AUTH_UI_SUBMIT', {
                mode,
                values,
                timestamp: Date.now()
            });
            appendLog(`${mode} intent published. Awaiting service response...`);
            return;
        }

        const timerId = setTimeout(() => {
            cleanupTimers.delete(timerId);
            setStatus('success', `${mode} (mocked)`);
            appendLog(`Mocked ${mode} for ${values.email || 'user'}`);
        }, 600);
        cleanupTimers.add(timerId);
    };

    const cleanupTimers = new Set();

    toggleButtons.forEach((btn) => {
        const handleClick = () => switchView(btn.dataset.authView);
        btn.addEventListener('click', handleClick);
        cleanups.push(() => btn.removeEventListener('click', handleClick));
    });

    forms.forEach((form) => {
        const handleSubmit = (event) => {
            event.preventDefault();
            const formData = Object.fromEntries(new FormData(form).entries());
            submitAuth(form.dataset.authForm, formData);
        };
        form.addEventListener('submit', handleSubmit);
        cleanups.push(() => form.removeEventListener('submit', handleSubmit));
    });

    if (eventBus?.subscribe) {
        cleanups.push(
            eventBus.subscribe('AUTH_UI_STATE_CHANGED', (payload) => {
                setStatus(payload.status, payload.error || '');
                if (payload.user) {
                    appendLog(`User session updated: ${JSON.stringify(payload.user)}`);
                }
            }),
            eventBus.subscribe('AUTH_UI_ERROR', ({ mode, error }) => {
                setStatus('error', error);
                appendLog(`Error (${mode}): ${error}`);
            })
        );
    }

    appendLog('Auth UI ready. Fill the form and submit.');
    switchView(container?.dataset.view || 'login');

    authUICleanup = () => {
        cleanupTimers.forEach((timerId) => clearTimeout(timerId));
        cleanupTimers.clear();
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
        if (authUICleanup) {
            authUICleanup = null;
        }
    };

    return authUICleanup;
}

if (typeof window !== 'undefined') {
    authUICleanup = initAuthUIPattern();
}
