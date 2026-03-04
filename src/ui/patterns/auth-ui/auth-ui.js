const csma = window.csma || {};
const authUI = csma.authUI;
const eventBus = csma.eventBus;

const statusEl = document.querySelector('[data-auth-status]');
const logEl = document.querySelector('[data-auth-log]');
const forms = document.querySelectorAll('[data-auth-form]');
const toggleButtons = document.querySelectorAll('[data-auth-view]');

let currentView = 'login';

function init() {
    toggleButtons.forEach((btn) => {
        btn.addEventListener('click', () => switchView(btn.dataset.authView));
    });

    forms.forEach((form) => {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const formData = Object.fromEntries(new FormData(form).entries());
            submitAuth(form.dataset.authForm, formData);
        });
    });

    appendLog('Auth UI ready. Fill the form and submit.');

    if (eventBus?.subscribe) {
        eventBus.subscribe('AUTH_UI_STATE_CHANGED', (payload) => {
            setStatus(payload.status, payload.error || '');
            if (payload.user) {
                appendLog(`User session updated: ${JSON.stringify(payload.user)}`);
            }
        });
        eventBus.subscribe('AUTH_UI_ERROR', ({ mode, error }) => {
            setStatus('error', error);
            appendLog(`Error (${mode}): ${error}`);
        });
    }
}

function switchView(view) {
    currentView = view;
    const container = document.querySelector('[data-auth-container]');
    if (container) {
        container.dataset.view = view;
    }
    toggleButtons.forEach((btn) => {
        btn.dataset.variant = btn.dataset.authView === view ? 'primary' : 'secondary';
        btn.setAttribute('aria-selected', btn.dataset.authView === view ? 'true' : 'false');
    });
    forms.forEach((form) => {
        form.hidden = form.dataset.authForm !== view;
    });
}

async function submitAuth(mode, values) {
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

    // Fallback mock behaviour
    setTimeout(() => {
        setStatus('success', `${mode} (mocked)`);
        appendLog(`Mocked ${mode} for ${values.email || 'user'}`);
    }, 600);
}

function setStatus(state, message) {
    statusEl.dataset.state = state;
    statusEl.textContent = message || `Status: ${state}`;
}

function appendLog(text) {
    if (!logEl) return;
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    logEl.prepend(entry);
}

init();
