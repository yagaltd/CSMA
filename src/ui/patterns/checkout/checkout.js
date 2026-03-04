const checkoutService = window.csma?.checkout;
const formManager = window.csma?.form;
const eventBus = window.csma?.eventBus;

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

function isOptimisticEnabled() {
    const optimisticReady = Boolean(window.csma?.optimisticSync?.registerIntent);
    if (!optimisticReady) {
        return false;
    }
    const allowGuest = Boolean(window.csma?.config?.optimisticSync?.allowGuestCheckout);
    const auth = window.csma?.auth;
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

function init() {
    renderItems();
    startSession();

    formEl.addEventListener('submit', (event) => {
        event.preventDefault();
        handleSubmit();
    });

    if (eventBus?.subscribe) {
        eventBus.subscribe('CHECKOUT_STATE_CHANGED', (payload) => {
            if (payload.checkoutId !== checkoutId) return;
            updateTotals(payload.totals);
            setStatus(payload.status);
        });
        eventBus.subscribe('CHECKOUT_COMPLETED', (payload) => {
            if (payload.checkoutId !== checkoutId) return;
            setStatus('completed', `Order ${payload.orderId} created.`);
        });
        eventBus.subscribe('CHECKOUT_ERROR', ({ checkoutId: id, error }) => {
            if (id !== checkoutId) return;
            setStatus('error', error);
        });
        ['OPTIMISTIC_ACTION_RECORDED', 'OPTIMISTIC_ACTION_ACKED', 'OPTIMISTIC_ACTION_FAILED', 'OPTIMISTIC_LOG_UPDATED']
            .forEach((event) => eventBus.subscribe(event, (payload) => {
                recordOptimisticEvent(event, payload);
                updateOptimisticDebug();
            }));
        eventBus.subscribe('AUTH_SESSION_UPDATED', () => updateOptimisticDebug());
    }

    updateOptimisticDebug();
}

function renderItems() {
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
        btn.addEventListener('click', () => adjustQuantity(Number(btn.dataset.index), Number(btn.dataset.qty)));
    });
}

function adjustQuantity(index, delta) {
    const item = items[index];
    item.quantity = Math.max(1, item.quantity + delta);
    renderItems();
    startSession();
}

function startSession() {
    const payload = {
        checkoutId,
        items: clone(items),
        currency: 'USD',
        metadata: { email: formEl.email.value }
    };

    if (checkoutService?.startSession) {
        checkoutService.startSession(payload);
    } else if (eventBus?.publish) {
        eventBus.publish('INTENT_CHECKOUT_START', { ...payload, timestamp: Date.now() });
    } else {
        updateTotals(calcTotals(payload.items));
    }
}

async function handleSubmit() {
    const values = Object.fromEntries(new FormData(formEl).entries());
    const optimisticActive = isOptimisticEnabled();
    setStatus(optimisticActive ? 'pending' : 'in_progress', optimisticActive ? 'Queued for optimistic flush...' : 'Submitting order...');

    if (formManager?.updateField) {
        Object.entries(values).forEach(([name, value]) => {
            try {
                formManager.updateField({ formId: `checkout.form.${checkoutId}`, name, value });
            } catch (_) {
                // ignore if form not registered
            }
        });
    }

    if (optimisticActive && eventBus?.publish) {
        await eventBus.publish('INTENT_CHECKOUT_SUBMIT', { checkoutId, timestamp: Date.now() });
        updateOptimisticDebug();
        return;
    }

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

    setTimeout(() => {
        setStatus('completed', 'Mock order generated.');
    }, 800);
}

function updateTotals(totals = calcTotals(items)) {
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

    const log = window.csma?.actionLog;
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

init();
