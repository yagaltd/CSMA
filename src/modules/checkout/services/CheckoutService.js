const DEFAULT_OPTIONS = {
    taxRate: 0.07,
    checkoutFormPrefix: 'checkout.form.',
    allowGuestOptimistic: false
};

export class CheckoutService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.formService = options.formService || null;
        this.syncQueue = options.syncQueue || null;
        this.authService = options.authService || null;
        this.hmacService = options.hmacService || null;
        this.optimisticSync = options.optimisticSync || null;
        this.allowGuestOptimistic = Boolean(options.allowGuestOptimistic);
        this.submitHandler = options.submitHandler || (async ({ checkoutId, values, items }) => ({
            orderId: `${checkoutId || 'order'}-${Date.now()}`,
            receipt: { values, items }
        }));
        this.sessions = new Map();
        this.subscriptions = [];
        this.optimisticIntentRegistered = false;
        this.manualSubmitUnsubscribe = null;
    }

    init({
        formService,
        syncQueueService,
        submitHandler,
        authService,
        hmacService,
        optimisticSyncService,
        allowGuestOptimistic
    } = {}) {
        if (formService) {
            this.formService = formService;
        }
        if (syncQueueService) {
            this.syncQueue = syncQueueService;
        }
        if (submitHandler) {
            this.submitHandler = submitHandler;
        }
        if (authService) {
            this.authService = authService;
        }
        if (hmacService) {
            this.hmacService = hmacService;
        }
        if (optimisticSyncService) {
            this.optimisticSync = optimisticSyncService;
        }
        if (typeof allowGuestOptimistic === 'boolean') {
            this.allowGuestOptimistic = allowGuestOptimistic;
        }

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_CHECKOUT_START', (payload) => this.startSession(payload)),
                this.eventBus.subscribe('INTENT_CHECKOUT_RESET', (payload) => this.reset(payload)),
                this.eventBus.subscribe('AUTH_SESSION_UPDATED', () => this.#syncOptimisticRegistration())
            );
        }

        this.#syncOptimisticRegistration();
    }

    startSession({ checkoutId = this.#generateId('checkout'), items = [], currency = 'USD', metadata = {} } = {}) {
        const totals = this.#calculateTotals(items);
        const formId = this.#formId(checkoutId);

        this.#ensureForm(formId, metadata);

        const session = {
            id: checkoutId,
            items,
            currency,
            metadata,
            totals,
            status: 'idle',
            formId
        };

        this.sessions.set(checkoutId, session);
        this.#publish('CHECKOUT_STATE_CHANGED', {
            checkoutId,
            status: session.status,
            totals,
            items,
            timestamp: Date.now()
        });

        return checkoutId;
    }

    async submit({ checkoutId, strategy = 'direct' } = {}) {
        const session = this.sessions.get(checkoutId);
        if (!session) {
            throw new Error(`Checkout session ${checkoutId} not found`);
        }

        const values = this.formService?.getFormState(session.formId)?.values;
        if (!values) {
            this.#emitError(checkoutId, 'Missing checkout form values');
            return { success: false };
        }

        const integrityEnvelope = await this.#maybeSignPayload({
            checkoutId,
            values,
            items: session.items,
            totals: session.totals
        });

        if (strategy === 'queue' && this.syncQueue?.enqueue) {
            this.syncQueue.enqueue({
                type: 'CHECKOUT_SUBMIT',
                payload: {
                    checkoutId,
                    items: session.items,
                    values,
                    totals: session.totals,
                    currency: session.currency,
                    integrity: integrityEnvelope || undefined
                }
            });
            session.status = 'queued';
            this.#publishState(session);
            return { success: true, queued: true, integrity: integrityEnvelope || undefined };
        }

        session.status = 'in_progress';
        this.#publishState(session);

        try {
            const result = await this.submitHandler({
                checkoutId,
                values,
                items: session.items,
                currency: session.currency,
                totals: session.totals,
                integrity: integrityEnvelope || undefined
            });

            session.status = 'completed';
            this.#publishState(session);

            this.#publish('CHECKOUT_COMPLETED', {
                checkoutId,
                orderId: result.orderId || this.#generateId('order'),
                totals: session.totals,
                timestamp: Date.now()
            });
            return { success: true, orderId: result.orderId, integrity: integrityEnvelope || undefined };
        } catch (error) {
            session.status = 'error';
            this.#publishState(session);
            this.#emitError(checkoutId, error?.message || String(error));
            return { success: false, error };
        }
    }

    reset({ checkoutId }) {
        const session = this.sessions.get(checkoutId);
        if (!session) {
            return;
        }
        this.formService?.resetForm({ formId: session.formId });
        this.sessions.delete(checkoutId);
        this.#publish('CHECKOUT_STATE_CHANGED', {
            checkoutId,
            status: 'idle',
            totals: { subtotal: 0, tax: 0, total: 0 },
            items: [],
            timestamp: Date.now()
        });
    }

    destroy() {
        this.sessions.clear();
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
        if (this.optimisticIntentRegistered) {
            this.optimisticSync?.unregisterIntent?.('INTENT_CHECKOUT_SUBMIT');
            this.optimisticIntentRegistered = false;
        }
        if (this.manualSubmitUnsubscribe) {
            this.manualSubmitUnsubscribe();
            this.manualSubmitUnsubscribe = null;
        }
    }

    #registerOptimisticIntent() {
        if (!this.optimisticSync?.registerIntent || this.optimisticIntentRegistered) {
            return;
        }

        this.optimisticSync.registerIntent('INTENT_CHECKOUT_SUBMIT', {
            actionCreator: 'checkout.submit',
            reducerId: 'checkout.orders',
            channels: () => ['global'],
            crdt: {
                type: 'lww-register',
                key: (payload = {}) => `checkout:${payload.checkoutId || 'default'}`,
                value: (payload = {}) => ({
                    checkoutId: payload.checkoutId || 'default',
                    kind: 'submission',
                    submittedAt: Date.now()
                })
            },
            applyLocal: (payload = {}) => {
                this.#setSessionStatus(payload.checkoutId, 'pending');
            },
            flush: async (payload = {}) => {
                await this.submit({ checkoutId: payload.checkoutId });
            },
            onError: (error, entry) => {
                const checkoutId = entry?.payload?.checkoutId;
                this.#setSessionStatus(checkoutId, 'error');
            }
        });

        this.optimisticIntentRegistered = true;
    }

    #ensureManualSubmitSubscription() {
        if (this.manualSubmitUnsubscribe || !this.eventBus) {
            return;
        }
        this.manualSubmitUnsubscribe = this.eventBus.subscribe('INTENT_CHECKOUT_SUBMIT', (payload) => this.submit(payload));
    }

    #teardownManualSubmitSubscription() {
        if (this.manualSubmitUnsubscribe) {
            this.manualSubmitUnsubscribe();
            this.manualSubmitUnsubscribe = null;
        }
    }

    #shouldUseOptimistic() {
        if (!this.optimisticSync?.registerIntent) {
            return false;
        }
        if (this.allowGuestOptimistic) {
            return true;
        }
        return Boolean(this.authService?.isAuthenticated?.());
    }

    #syncOptimisticRegistration() {
        const shouldUseOptimistic = this.#shouldUseOptimistic();
        if (shouldUseOptimistic) {
            if (!this.optimisticIntentRegistered) {
                this.#registerOptimisticIntent();
            }
            this.#teardownManualSubmitSubscription();
        } else {
            if (this.optimisticIntentRegistered) {
                this.optimisticSync?.unregisterIntent?.('INTENT_CHECKOUT_SUBMIT');
                this.optimisticIntentRegistered = false;
            }
            this.#ensureManualSubmitSubscription();
        }
    }

    #ensureForm(formId, metadata) {
        if (!this.formService?.registerForm) {
            return;
        }

        try {
            this.formService.registerForm({
                formId,
                schema: this.#defaultSchema,
                initialValues: {
                    email: metadata.email || '',
                    name: metadata.name || '',
                    address: metadata.address || '',
                    paymentMethod: 'card'
                },
                metadata,
                autoSave: true
            });
        } catch (_) {
            // Already registered
        }
    }

    #defaultSchema(values = {}) {
        const errors = {};
        if (!values.email) errors.email = 'Email required';
        if (!values.name) errors.name= 'Name required';
        if (!values.address) errors.address = 'Address required';
        if (!values.paymentMethod) errors.paymentMethod = 'Payment method required';
        return errors;
    }

    #calculateTotals(items) {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = Number((subtotal * this.options.taxRate).toFixed(2));
        const total = Number((subtotal + tax).toFixed(2));
        return { subtotal, tax, total };
    }

    async #maybeSignPayload({ checkoutId, values, items, totals }) {
        if (this.authService?.isAuthenticated?.()) {
            return null;
        }
        if (!this.hmacService?.signPayload) {
            return null;
        }

        const intent = `CHECKOUT_SUBMIT_${(checkoutId || 'default').toString().toUpperCase()}`;
        try {
            const envelope = await this.hmacService.signPayload({
                intent,
                payload: {
                    values,
                    items,
                    totals
                }
            });
            return envelope;
        } catch (error) {
            this.#emitError(checkoutId, error?.message || String(error));
            return null;
        }
    }

    #publishState(session) {
        this.#publish('CHECKOUT_STATE_CHANGED', {
            checkoutId: session.id,
            status: session.status,
            totals: session.totals,
            items: session.items,
            timestamp: Date.now()
        });
    }

    #emitError(checkoutId, message) {
        this.eventBus?.publish('CHECKOUT_ERROR', {
            checkoutId,
            error: message,
            timestamp: Date.now()
        });
    }

    #setSessionStatus(checkoutId, status) {
        if (!checkoutId) return;
        const session = this.sessions.get(checkoutId);
        if (!session) return;
        session.status = status;
        this.#publishState(session);
    }

    #formId(checkoutId) {
        return `${this.options.checkoutFormPrefix}${checkoutId}`;
    }

    #publish(event, payload) {
        this.eventBus?.publish(event, payload);
    }

    #generateId(prefix) {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
}
