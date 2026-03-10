const clone = typeof structuredClone === 'function'
    ? structuredClone
    : (value) => JSON.parse(JSON.stringify(value));

const items = [
    { id: 'kit-01', name: 'Starter Kit', price: 49, quantity: 1 },
    { id: 'kit-02', name: 'Offline Sync add-on', price: 19, quantity: 2 }
];

const formEl = document.querySelector('[data-checkout-form]');
const listEl = document.querySelector('[data-cart-items]');
const totalsEls = {
    subtotal: document.querySelector('[data-total="subtotal"]'),
    tax: document.querySelector('[data-total="tax"]'),
    total: document.querySelector('[data-total="total"]')
};
const statusEl = document.querySelector('[data-checkout-status]');
const optimisticPanel = document.querySelector('[data-checkout-optimistic]');
const optimisticStateEl = document.querySelector('[data-optimistic-state]');
const optimisticPendingEl = document.querySelector('[data-optimistic-pending]');
const optimisticUpdatedEl = document.querySelector('[data-optimistic-updated]');

const checkoutId = 'demo-checkout';
const optimisticTelemetry = {
    lastEvent: null,
    lastTimestamp: null
};

let checkoutCleanup = null;
let quantityButtonCleanups = [];
let mockSubmitTimer = null;

function getRuntime() {
    return window.csma || {};
}

function getCheckoutService() {
    return getRuntime().checkout;
}

function getFormManager() {
    return getRuntime().form;
}

function getEventBus() {
    return getRuntime().eventBus;
}

function isOptimisticEnabled() {
    const optimisticReady = Boolean(getRuntime().optimisticSync?.registerIntent);
    if (!optimisticReady) {
        return false;
    }
    const allowGuest = Boolean(getRuntime().config?.optimisticSync?.allowGuestCheckout);
    const auth = getRuntime().auth;
    if (!auth?.isAuthenticated) {
        return allowGuest;
    }
    const authenticated = auth.isAuthenticated();
    return authenticated || allowGuest;
}

function recordOptimisticEvent(type, payload) {
    optimisticTelemetry.lastEvent = {
        type,
        intent: payload?.entry?.intent || payload?.intent || 'unknown',
        status: type === 'OPTIMISTIC_ACTION_ACKED'
            ? 'acked'
            : type === 'OPTIMISTIC_ACTION_FAILED'
                ? 'failed'
                : 'pending'
    };
    optimisticTelemetry.lastTimestamp = Date.now();
}

export function initCheckoutPattern() {
    checkoutCleanup?.();

    const cleanups = [];
    const addCleanup = (cleanup) => {
        if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
        }
    };

    renderItems();
    startSession();

    if (formEl) {
        const handleFormSubmit = (event) => {
            event.preventDefault();
            handleSubmit();
        };
        formEl.addEventListener('submit', handleFormSubmit);
        addCleanup(() => formEl.removeEventListener('submit', handleFormSubmit));
    }

    const eventBus = getEventBus();
    if (eventBus?.subscribe) {
        addCleanup(eventBus.subscribe('CHECKOUT_STATE_CHANGED', (payload) => {
            if (payload.checkoutId !== checkoutId) return;
            updateTotals(payload.totals);
            setStatus(payload.status);
        }));
        addCleanup(eventBus.subscribe('CHECKOUT_COMPLETED', (payload) => {
            if (payload.checkoutId !== checkoutId) return;
            setStatus('completed', `Order ${payload.orderId} created.`);
        }));
        addCleanup(eventBus.subscribe('CHECKOUT_ERROR', ({ checkoutId: id, error }) => {
            if (id !== checkoutId) return;
            setStatus('error', error);
        }));
        ['OPTIMISTIC_ACTION_RECORDED', 'OPTIMISTIC_ACTION_ACKED', 'OPTIMISTIC_ACTION_FAILED', 'OPTIMISTIC_LOG_UPDATED']
            .forEach((eventName) => {
                addCleanup(eventBus.subscribe(eventName, (payload) => {
                    recordOptimisticEvent(eventName, payload);
                    updateOptimisticDebug();
                }));
            });
        addCleanup(eventBus.subscribe('AUTH_SESSION_UPDATED', () => updateOptimisticDebug()));
    }

    updateOptimisticDebug();

    checkoutCleanup = () => {
        if (mockSubmitTimer) {
            clearTimeout(mockSubmitTimer);
            mockSubmitTimer = null;
        }
        quantityButtonCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
        cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
        if (checkoutCleanup) {
            checkoutCleanup = null;
        }
    };

    return checkoutCleanup;
}

function renderItems() {
    if (!listEl) {
        return;
    }

    quantityButtonCleanups.splice(0).reverse().forEach((cleanup) => cleanup());
    listEl.innerHTML = '';

    items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'csma-cart-item';
        row.innerHTML = `
            <div>
                <h3>${item.name}</h3>
                <p class="text-muted">${currency(item.price)} · SKU ${item.id}</p>
            </div>
            <div class="csma-cart-controls">
                <button type="button" class="button" data-variant="ghost" data-shape="icon" aria-label="Decrease" data-qty="-1" data-index="${index}">-</button>
                <span>${item.quantity}</span>
                <button type="button" class="button" data-variant="ghost" data-shape="icon" aria-label="Increase" data-qty="1" data-index="${index}">+</button>
            </div>
        `;
        listEl.appendChild(row);
    });

    listEl.querySelectorAll('button[data-qty]').forEach((btn) => {
        const handleClick = () => adjustQuantity(Number(btn.dataset.index), Number(btn.dataset.qty));
        btn.addEventListener('click', handleClick);
        quantityButtonCleanups.push(() => btn.removeEventListener('click', handleClick));
    });
}

function adjustQuantity(index, delta) {
    const item = items[index];
    item.quantity = Math.max(1, item.quantity + delta);
    renderItems();
    startSession();
}

function startSession() {
    if (!formEl) {
        return;
    }

    const payload = {
        checkoutId,
        items: clone(items),
        currency: 'USD',
        metadata: { email: formEl.email.value }
    };

    const checkoutService = getCheckoutService();
    const eventBus = getEventBus();
    if (checkoutService?.startSession) {
        checkoutService.startSession(payload);
    } else if (eventBus?.publish) {
        eventBus.publish('INTENT_CHECKOUT_START', { ...payload, timestamp: Date.now() });
    } else {
        updateTotals(calcTotals(payload.items));
    }
}

async function handleSubmit() {
    if (!formEl) {
        return;
    }

    const values = Object.fromEntries(new FormData(formEl).entries());
    const optimisticActive = isOptimisticEnabled();
    setStatus(optimisticActive ? 'pending' : 'in_progress', optimisticActive ? 'Queued for optimistic flush...' : 'Submitting order...');

    const formManager = getFormManager();
    if (formManager?.updateField) {
        Object.entries(values).forEach(([name, value]) => {
            try {
                formManager.updateField({ formId: `checkout.form.${checkoutId}`, name, value });
            } catch (_) {
                // ignore if form not registered
            }
        });
    }

    const eventBus = getEventBus();
    if (optimisticActive && eventBus?.publish) {
        await eventBus.publish('INTENT_CHECKOUT_SUBMIT', { checkoutId, timestamp: Date.now() });
        updateOptimisticDebug();
        return;
    }

    const checkoutService = getCheckoutService();
    if (checkoutService?.submit) {
        const result = await checkoutService.submit({ checkoutId });
        if (result.success) {
            setStatus('completed', 'Checkout completed via service.');
        }
        return;
    }

    if (eventBus?.publish) {
        await eventBus.publish('INTENT_CHECKOUT_SUBMIT', { checkoutId, timestamp: Date.now() });
        return;
    }

    mockSubmitTimer = window.setTimeout(() => {
        mockSubmitTimer = null;
        setStatus('completed', 'Mock order generated.');
    }, 800);
}

function updateTotals(totals = calcTotals(items)) {
    if (!totalsEls.subtotal || !totalsEls.tax || !totalsEls.total) {
        return;
    }
    totalsEls.subtotal.textContent = currency(totals.subtotal);
    totalsEls.tax.textContent = currency(totals.tax);
    totalsEls.total.textContent = currency(totals.total);
}

function calcTotals(dataset) {
    const subtotal = dataset.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = Number((subtotal * 0.07).toFixed(2));
    const total = Number((subtotal + tax).toFixed(2));
    return { subtotal, tax, total };
}

function currency(value) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function setStatus(state, message) {
    if (!statusEl) {
        return;
    }
    statusEl.dataset.state = state;
    statusEl.textContent = message || `Status: ${state}`;
    updateOptimisticDebug();
}

function updateOptimisticDebug() {
    if (!optimisticPanel || !optimisticStateEl || !optimisticPendingEl || !optimisticUpdatedEl) {
        return;
    }
    if (!isOptimisticEnabled()) {
        optimisticPanel.hidden = true;
        return;
    }

    const log = getRuntime().actionLog;
    if (!log?.getPending) {
        optimisticPanel.hidden = true;
        return;
    }

    const entries = (log.getPending() || []).filter(
        (entry) => entry.intent === 'INTENT_CHECKOUT_SUBMIT' && entry.payload?.checkoutId === checkoutId
    );

    optimisticPanel.hidden = false;
    optimisticPendingEl.textContent = String(entries.length);

    if (entries.length) {
        const latest = entries[entries.length - 1];
        optimisticStateEl.textContent = latest.status || 'pending';
        const updated = latest.updatedAt || latest.createdAt || Date.now();
        optimisticUpdatedEl.textContent = new Date(updated).toLocaleTimeString();
        return;
    }

    if (optimisticTelemetry.lastEvent) {
        optimisticStateEl.textContent = `${optimisticTelemetry.lastEvent.status} · ${optimisticTelemetry.lastEvent.intent}`;
        optimisticUpdatedEl.textContent = new Date(optimisticTelemetry.lastTimestamp || Date.now()).toLocaleTimeString();
    } else {
        optimisticStateEl.textContent = 'idle';
        optimisticUpdatedEl.textContent = 'never';
    }
}

if (typeof window !== 'undefined') {
    checkoutCleanup = initCheckoutPattern();
}
