const DEFAULT_OPTIONS = {
    autoSave: true,
    autoSaveDelay: 1200,
    storageKeyPrefix: 'csma.form.',
    validateOnFieldChange: true
};

export class FormManagementService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.storage = options.storage || null;
        this.syncQueue = options.syncQueue || null;
        this.hmac = options.hmacService || options.hmac || null;
        this.forms = new Map();
        this.autoSaveTimers = new Map();
        this.subscriptions = [];
    }

    init({ storageService, syncQueueService, hmacService } = {}) {
        if (storageService) {
            this.storage = storageService;
        }
        if (syncQueueService) {
            this.syncQueue = syncQueueService;
        }
        if (hmacService) {
            this.hmac = hmacService;
        }

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_FORM_REGISTER', (payload = {}) => this.registerForm(payload)),
                this.eventBus.subscribe('INTENT_FORM_UPDATE_FIELD', (payload = {}) => this.updateField(payload)),
                this.eventBus.subscribe('INTENT_FORM_RESET', (payload = {}) => this.resetForm(payload)),
                this.eventBus.subscribe('INTENT_FORM_SUBMIT', (payload = {}) => this.submitForm(payload))
            );
        }
    }

    registerForm({ formId, schema = null, initialValues = {}, metadata = {}, autoSave, autoSaveDelay } = {}) {
        if (!formId) {
            throw new Error('formId is required to register a form');
        }

        const existing = this.forms.get(formId);
        const shouldAutoSave = autoSave ?? this.options.autoSave;
        const persisted = shouldAutoSave ? this.#loadStoredState(formId) : null;
        const values = this.#clone({ ...initialValues });
        if (persisted?.values) {
            Object.assign(values, persisted.values);
        }

        const form = {
            id: formId,
            schema: schema || existing?.schema || null,
            initialValues: this.#clone(initialValues),
            values,
            errors: persisted?.errors || existing?.errors || {},
            touched: persisted?.touched || existing?.touched || {},
            dirty: persisted?.dirty || existing?.dirty || {},
            metadata: this.#clone(metadata) || {},
            status: 'idle',
            autoSave: shouldAutoSave,
            autoSaveDelay: autoSaveDelay ?? this.options.autoSaveDelay,
            lastSavedAt: persisted?.lastSavedAt || null
        };

        this.forms.set(formId, form);
        this.#publishState(form);
        return this.#serializeFormState(form);
    }

    updateField({ formId, name, value, validate = this.options.validateOnFieldChange } = {}) {
        const form = this.#requireForm(formId);
        if (!name) {
            throw new Error('Field name is required');
        }

        form.values[name] = value;
        form.touched[name] = true;
        form.dirty[name] = !this.#isEqual(value, form.initialValues[name]);

        if (validate) {
            this.#validateForm(form);
        }

        this.#scheduleAutoSave(form);

        const fieldErrors = form.errors[name] ? { [name]: form.errors[name] } : undefined;
        this.#publish('FORM_FIELD_UPDATED', {
            formId,
            name,
            value,
            errors: fieldErrors,
            valid: Object.keys(form.errors).length === 0,
            timestamp: Date.now()
        });
        this.#publishState(form);
        return { value, errors: this.#clone(form.errors) };
    }

    resetForm({ formId, values } = {}) {
        const form = this.#requireForm(formId);
        form.values = values ? this.#clone(values) : this.#clone(form.initialValues);
        form.errors = {};
        form.touched = {};
        form.dirty = {};
        form.status = 'idle';
        form.lastSavedAt = null;
        this.#clearAutoSave(formId);
        this.#removePersistedState(formId);
        this.#publishState(form);
        return this.#serializeFormState(form);
    }

    getFormState(formId) {
        const form = this.forms.get(formId);
        return form ? this.#serializeFormState(form) : null;
    }

    async submitForm({ formId, strategy = 'direct', metadata = {}, jobType } = {}) {
        const form = this.#requireForm(formId);
        const errors = this.#validateForm(form);
        if (Object.keys(errors).length > 0) {
            this.#publish('FORM_ERROR', {
                formId,
                errors: this.#clone(errors),
                timestamp: Date.now()
            });
            return { success: false, errors };
        }

        form.status = 'submitting';
        this.#publishState(form);

        const values = this.#clone(form.values);
        const integrityEnvelope = await this.#maybeSignPayload({ form, metadata, values });

        if ((strategy === 'queue' || metadata.enqueue) && this.syncQueue?.enqueue) {
            try {
                this.syncQueue.enqueue({
                    type: jobType || metadata.jobType || `FORM_SUBMIT_${formId}`.toUpperCase(),
                    payload: {
                        formId,
                        values,
                        metadata: this.#clone(metadata),
                        integrity: integrityEnvelope || undefined
                    }
                });
            } catch (error) {
                this.#publish('FORM_ERROR', {
                    formId,
                    errors: { queue: error?.message || String(error) },
                    timestamp: Date.now()
                });
                form.status = 'idle';
                this.#publishState(form);
                return { success: false, errors: { queue: error?.message || String(error) } };
            }
        }

        this.#publish('FORM_SUBMITTED', {
            formId,
            values,
            metadata: this.#clone(metadata) || {},
            integrity: integrityEnvelope || undefined,
            submittedAt: Date.now()
        });

        form.status = 'idle';
        this.#publishState(form);
        return { success: true, integrity: integrityEnvelope || undefined };
    }

    destroy() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
        for (const timer of this.autoSaveTimers.values()) {
            clearTimeout(timer);
        }
        this.autoSaveTimers.clear();
        this.forms.clear();
    }

    #requireForm(formId) {
        const form = this.forms.get(formId);
        if (!form) {
            throw new Error(`Form ${formId} is not registered`);
        }
        return form;
    }

    #validateForm(form) {
        if (!form.schema) {
            form.errors = {};
            return form.errors;
        }

        if (typeof form.schema === 'function' && typeof form.schema.validate !== 'function') {
            const result = form.schema(form.values);
            form.errors = result && typeof result === 'object' ? { ...result } : {};
            return form.errors;
        }

        if (form.schema && typeof form.schema.validate === 'function') {
            const [error] = form.schema.validate(form.values);
            if (!error) {
                form.errors = {};
                return form.errors;
            }

            const mapped = {};
            if (typeof error.failures === 'function') {
                for (const failure of error.failures()) {
                    const key = failure.path && failure.path.length > 0
                        ? failure.path.join('.')
                        : failure.key || 'form';
                    mapped[key] = failure.message;
                }
            } else {
                const key = error.path && error.path.length > 0 ? error.path.join('.') : 'form';
                mapped[key] = error.message;
            }
            form.errors = mapped;
            return form.errors;
        }

        form.errors = {};
        return form.errors;
    }

    #scheduleAutoSave(form) {
        if (!form.autoSave || !this.storage?.setItem) {
            return;
        }

        this.#clearAutoSave(form.id);
        const delay = Math.max(0, form.autoSaveDelay ?? this.options.autoSaveDelay);

        if (delay === 0) {
            this.#persistForm(form);
            return;
        }

        const timer = setTimeout(() => {
            this.#persistForm(form);
            this.autoSaveTimers.delete(form.id);
        }, delay);
        this.autoSaveTimers.set(form.id, timer);
    }

    #persistForm(form) {
        if (!this.storage?.setItem || !form.autoSave) {
            return;
        }

        try {
            const snapshot = {
                values: form.values,
                touched: form.touched,
                dirty: form.dirty,
                errors: form.errors,
                lastSavedAt: Date.now()
            };
            this.storage.setItem(this.#storageKey(form.id), JSON.stringify(snapshot));
            form.lastSavedAt = snapshot.lastSavedAt;
        } catch (error) {
            console.warn('[FormManagement] Failed to persist form state', error);
        }
    }

    async #maybeSignPayload({ form, metadata, values }) {
        const integrityConfig = metadata?.integrity || form.metadata?.integrity || null;
        const requireIntegrity = integrityConfig?.require ?? metadata?.requireIntegrity ?? form.metadata?.requireIntegrity ?? false;
        if (!requireIntegrity) {
            return null;
        }

        if (!this.hmac?.signPayload) {
            console.warn('[FormManagement] Integrity requested but HmacService unavailable');
            return null;
        }

        const intent = integrityConfig?.intent || `FORM_SUBMIT_${form.id}`.toUpperCase();
        this.#publish('INTENT_PUBLIC_FORM_SUBMIT', {
            formId: form.id,
            intent,
            timestamp: Date.now()
        });
        try {
            const envelope = await this.hmac.signPayload({
                intent,
                payload: values,
                nonce: integrityConfig?.nonce
            });
            return envelope;
        } catch (error) {
            this.#publish('FORM_ERROR', {
                formId: form.id,
                errors: { integrity: error?.message || String(error) },
                timestamp: Date.now()
            });
            this.#publish('PUBLIC_FORM_REJECTED', {
                formId: form.id,
                intent,
                reason: error?.message || String(error),
                timestamp: Date.now()
            });
            return null;
        }
    }

    #loadStoredState(formId) {
        if (!this.storage?.getItem) {
            return null;
        }
        try {
            const raw = this.storage.getItem(this.#storageKey(formId));
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('[FormManagement] Failed to load stored state', error);
            return null;
        }
    }

    #removePersistedState(formId) {
        if (!this.storage?.removeItem) {
            return;
        }
        try {
            this.storage.removeItem(this.#storageKey(formId));
        } catch (error) {
            console.warn('[FormManagement] Failed to remove stored state', error);
        }
    }

    #storageKey(formId) {
        return `${this.options.storageKeyPrefix}${formId}`;
    }

    #clearAutoSave(formId) {
        const timer = this.autoSaveTimers.get(formId);
        if (timer) {
            clearTimeout(timer);
            this.autoSaveTimers.delete(formId);
        }
    }

    #publishState(form) {
        this.#publish('FORM_STATE_CHANGED', {
            formId: form.id,
            state: this.#serializeFormState(form),
            timestamp: Date.now()
        });
    }

    #serializeFormState(form) {
        return {
            id: form.id,
            values: this.#clone(form.values),
            errors: this.#clone(form.errors),
            touched: this.#clone(form.touched),
            dirty: this.#clone(form.dirty),
            status: form.status,
            metadata: this.#clone(form.metadata),
            lastSavedAt: form.lastSavedAt
        };
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #clone(value) {
        if (value === null || value === undefined) {
            return value;
        }
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch (error) {
                // Fall through to JSON clone
            }
        }
        if (typeof value === 'object') {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch (error) {
                return { ...value };
            }
        }
        return value;
    }

    #isEqual(a, b) {
        if (a === b) {
            return true;
        }
        if (typeof a !== typeof b) {
            return false;
        }
        if (typeof a === 'object' && a && b) {
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            } catch (error) {
                return false;
            }
        }
        return false;
    }
}
