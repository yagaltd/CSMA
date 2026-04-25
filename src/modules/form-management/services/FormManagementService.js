const REDACTED = '[REDACTED]';

const DEFAULT_OPTIONS = {
    autoSave: false,
    autoSaveDelay: 1200,
    storageKeyPrefix: 'csma.form.',
    validateOnFieldChange: true,
    maxFieldLength: 4096,
    maxPayloadBytes: 65536,
    sensitiveFields: ['password', 'passcode', 'token', 'secret', 'ssn', 'creditCard', 'cardNumber', 'cvv']
};

export class FormManagementService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.storage = options.storage || null;
        this.syncQueue = options.syncQueue || null;
        this.integrityService = options.integrityService || options.hmacService || options.hmac || null;
        this.securityPolicy = options.securityPolicy || null;
        this.forms = new Map();
        this.autoSaveTimers = new Map();
        this.subscriptions = [];
    }

    init({ storageService, syncQueueService, integrityService, hmacService, securityPolicy } = {}) {
        if (storageService) this.storage = storageService;
        if (syncQueueService) this.syncQueue = syncQueueService;
        if (integrityService || hmacService) this.integrityService = integrityService || hmacService;
        if (securityPolicy) {
            this.securityPolicy = securityPolicy;
            this.options = {
                ...this.options,
                autoSave: securityPolicy.forms?.autoSave ?? this.options.autoSave,
                maxFieldLength: securityPolicy.forms?.maxFieldLength ?? this.options.maxFieldLength,
                maxPayloadBytes: securityPolicy.forms?.maxPayloadBytes ?? this.options.maxPayloadBytes,
                sensitiveFields: securityPolicy.forms?.sensitiveFields || this.options.sensitiveFields
            };
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

    registerForm({
        formId,
        schema = null,
        initialValues = {},
        metadata = {},
        autoSave,
        autoSaveDelay,
        fieldPolicies = {},
        sensitiveFields = [],
        trustLevel,
        persist
    } = {}) {
        if (!formId) {
            throw new Error('formId is required to register a form');
        }

        const existing = this.forms.get(formId);
        const normalizedMetadata = this.#normalizeMetadata({ ...metadata, trustLevel, persist });
        const policies = this.#normalizeFieldPolicies(fieldPolicies);
        const formSensitiveFields = [...new Set([...(this.options.sensitiveFields || []), ...sensitiveFields])];
        const initial = this.#applyPolicies(this.#clone({ ...initialValues }), policies);
        const shouldAutoSave = Boolean(autoSave ?? normalizedMetadata.persist ?? this.options.autoSave) &&
            !this.#hasSensitiveFields({ values: initial, policies, sensitiveFields: formSensitiveFields });
        const persisted = shouldAutoSave ? this.#loadStoredState(formId) : null;
        const values = this.#clone(initial);
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
            metadata: normalizedMetadata,
            fieldPolicies: policies,
            sensitiveFields: formSensitiveFields,
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
        if (!name) throw new Error('Field name is required');

        const normalizedValue = this.#applyFieldPolicy(name, value, form.fieldPolicies?.[name]);
        form.values[name] = normalizedValue;
        form.touched[name] = true;
        form.dirty[name] = !this.#isEqual(normalizedValue, form.initialValues[name]);

        if (validate) this.#validateForm(form);
        this.#scheduleAutoSave(form);

        const fieldErrors = form.errors[name] ? { [name]: form.errors[name] } : undefined;
        this.#publish('FORM_FIELD_UPDATED', {
            formId,
            name,
            value: this.#redactField(form, name, normalizedValue),
            errors: fieldErrors,
            valid: Object.keys(form.errors).length === 0,
            timestamp: Date.now()
        });
        this.#publishState(form);
        return { value: normalizedValue, errors: this.#clone(form.errors) };
    }

    resetForm({ formId, values } = {}) {
        const form = this.#requireForm(formId);
        form.values = values ? this.#applyPolicies(this.#clone(values), form.fieldPolicies) : this.#clone(form.initialValues);
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
        if (this.#detectHoneypot(form)) {
            const rejected = { honeypot: 'Submission rejected' };
            this.#publish('PUBLIC_FORM_REJECTED', {
                formId,
                intent: `FORM_SUBMIT_${formId}`.toUpperCase(),
                reason: 'HONEYPOT_FILLED',
                timestamp: Date.now()
            });
            return { success: false, errors: rejected };
        }
        if (Object.keys(errors).length > 0) {
            this.#publish('FORM_ERROR', { formId, errors: this.#clone(errors), timestamp: Date.now() });
            return { success: false, errors };
        }

        form.status = 'submitting';
        this.#publishState(form);

        const values = this.#clone(form.values);
        this.#enforcePayloadSize(values);
        const integrityEnvelope = await this.#maybePrepareSubmission({ form, metadata, values });
        if (integrityEnvelope === false) {
            const integrityError = { integrity: 'Submission integrity is required' };
            form.status = 'idle';
            this.#publish('FORM_ERROR', { formId, errors: integrityError, timestamp: Date.now() });
            this.#publishState(form);
            return { success: false, errors: integrityError };
        }

        const emittedValues = this.#redactValues(form, values);
        const emittedMetadata = this.#redactObject(this.#clone(metadata) || {});
        if ((strategy === 'queue' || metadata.enqueue) && this.syncQueue?.enqueue) {
            try {
                this.syncQueue.enqueue({
                    type: jobType || metadata.jobType || `FORM_SUBMIT_${formId}`.toUpperCase(),
                    payload: { formId, values: emittedValues, metadata: emittedMetadata, integrity: integrityEnvelope || undefined }
                });
            } catch (error) {
                const queueErrors = { queue: error?.message || String(error) };
                this.#publish('FORM_ERROR', { formId, errors: queueErrors, timestamp: Date.now() });
                form.status = 'idle';
                this.#publishState(form);
                return { success: false, errors: queueErrors };
            }
        }

        this.#publish('FORM_SUBMITTED', {
            formId,
            values: emittedValues,
            metadata: emittedMetadata,
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
        for (const timer of this.autoSaveTimers.values()) clearTimeout(timer);
        this.autoSaveTimers.clear();
        this.forms.clear();
    }

    #requireForm(formId) {
        const form = this.forms.get(formId);
        if (!form) throw new Error(`Form ${formId} is not registered`);
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
                    const key = failure.path && failure.path.length > 0 ? failure.path.join('.') : failure.key || 'form';
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
        if (!form.autoSave || !this.storage?.setItem) return;
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
        if (!this.storage?.setItem || !form.autoSave) return;
        try {
            const snapshot = {
                values: this.#redactValues(form, form.values, { omitSensitive: true }),
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

    async #maybePrepareSubmission({ form, metadata, values }) {
        const integrityConfig = metadata?.integrity || form.metadata?.integrity || null;
        const trustLevel = metadata?.trustLevel || form.metadata?.trustLevel || 'local';
        const requireIntegrity = integrityConfig?.require ??
            metadata?.requireIntegrity ??
            form.metadata?.requireIntegrity ??
            (trustLevel === 'public-network' && (this.securityPolicy?.forms?.requireIntegrityForPublicNetwork ?? true));
        if (!requireIntegrity) return null;

        const prepareSubmission = this.integrityService?.prepareSubmission || this.integrityService?.signPayload;
        const intent = integrityConfig?.intent || `FORM_SUBMIT_${form.id}`.toUpperCase();
        this.#publish('INTENT_PUBLIC_FORM_SUBMIT', { formId: form.id, intent, timestamp: Date.now() });

        if (!prepareSubmission) {
            console.warn('[FormManagement] Integrity requested but backend integrity service unavailable');
            this.#publish('PUBLIC_FORM_REJECTED', { formId: form.id, intent, reason: 'INTEGRITY_SERVICE_UNAVAILABLE', timestamp: Date.now() });
            return false;
        }

        try {
            return await prepareSubmission.call(this.integrityService, { intent, payload: values, nonce: integrityConfig?.nonce });
        } catch (error) {
            const reason = error?.message || String(error);
            this.#publish('FORM_ERROR', { formId: form.id, errors: { integrity: reason }, timestamp: Date.now() });
            this.#publish('PUBLIC_FORM_REJECTED', { formId: form.id, intent, reason, timestamp: Date.now() });
            return false;
        }
    }

    #loadStoredState(formId) {
        if (!this.storage?.getItem) return null;
        try {
            const raw = this.storage.getItem(this.#storageKey(formId));
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('[FormManagement] Failed to load stored state', error);
            return null;
        }
    }

    #removePersistedState(formId) {
        if (!this.storage?.removeItem) return;
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
        this.#publish('FORM_STATE_CHANGED', { formId: form.id, state: this.#serializeFormState(form), timestamp: Date.now() });
    }

    #serializeFormState(form) {
        return {
            id: form.id,
            values: this.#redactValues(form, form.values),
            errors: this.#clone(form.errors),
            touched: this.#clone(form.touched),
            dirty: this.#clone(form.dirty),
            status: form.status,
            metadata: this.#clone(form.metadata),
            lastSavedAt: form.lastSavedAt
        };
    }

    #normalizeMetadata(metadata = {}) {
        const trustLevel = metadata.trustLevel || 'local';
        if (!['local', 'authenticated-network', 'public-network'].includes(trustLevel)) {
            throw new Error('Invalid form trustLevel');
        }
        return { ...this.#clone(metadata), trustLevel };
    }

    #normalizeFieldPolicies(fieldPolicies = {}) {
        return Object.fromEntries(Object.entries(fieldPolicies || {}).map(([name, policy]) => [
            name,
            {
                trim: Boolean(policy?.trim),
                maxLength: policy?.maxLength ?? this.options.maxFieldLength,
                sensitive: Boolean(policy?.sensitive),
                persist: policy?.persist,
                redact: policy?.redact,
                emit: policy?.emit,
                honeypot: Boolean(policy?.honeypot)
            }
        ]));
    }

    #applyPolicies(values, policies) {
        for (const [name, policy] of Object.entries(policies || {})) {
            if (name in values) values[name] = this.#applyFieldPolicy(name, values[name], policy);
        }
        this.#enforcePayloadSize(values);
        return values;
    }

    #applyFieldPolicy(name, value, policy = {}) {
        let nextValue = value;
        if (policy.trim && typeof nextValue === 'string') nextValue = nextValue.trim();
        this.#enforceFieldSize(name, nextValue, policy.maxLength);
        return nextValue;
    }

    #enforceFieldSize(name, value, maxLength = this.options.maxFieldLength) {
        if (typeof value === 'string' && value.length > maxLength) {
            throw new Error(`Field ${name} exceeds maximum length`);
        }
    }

    #enforcePayloadSize(values) {
        const bytes = new TextEncoder().encode(JSON.stringify(values ?? {})).length;
        if (bytes > this.options.maxPayloadBytes) {
            throw new Error('Form payload exceeds maximum size');
        }
    }

    #hasSensitiveFields({ values = {}, policies = {}, sensitiveFields = [] } = {}) {
        const sensitive = new Set(sensitiveFields);
        return Object.keys(values).some((name) => sensitive.has(name) || policies[name]?.sensitive || policies[name]?.persist === false);
    }

    #isSensitiveField(form, name) {
        return form.sensitiveFields?.includes(name) || form.fieldPolicies?.[name]?.sensitive || form.fieldPolicies?.[name]?.redact === true;
    }

    #redactField(form, name, value) {
        const policy = form.fieldPolicies?.[name];
        if (policy?.emit === false) return undefined;
        return this.#isSensitiveField(form, name) ? REDACTED : this.#clone(value);
    }

    #redactValues(form, values, { omitSensitive = false } = {}) {
        const output = {};
        for (const [name, value] of Object.entries(values || {})) {
            const policy = form.fieldPolicies?.[name];
            if (policy?.emit === false || (omitSensitive && (this.#isSensitiveField(form, name) || policy?.persist === false))) continue;
            output[name] = this.#isSensitiveField(form, name) ? REDACTED : this.#clone(value);
        }
        return output;
    }

    #redactObject(value) {
        if (!value || typeof value !== 'object') return value;
        const sensitive = new Set(this.options.sensitiveFields || []);
        return Object.fromEntries(Object.entries(value).map(([key, nextValue]) => [
            key,
            sensitive.has(key) ? REDACTED : this.#clone(nextValue)
        ]));
    }

    #detectHoneypot(form) {
        return Object.entries(form.fieldPolicies || {}).some(([name, policy]) => {
            if (!policy?.honeypot) return false;
            const value = form.values?.[name];
            return value !== undefined && value !== null && String(value).length > 0;
        });
    }

    #publish(eventName, payload) {
        this.eventBus?.publish(eventName, payload);
    }

    #clone(value) {
        if (value === null || value === undefined) return value;
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(value);
            } catch {
                // Fall through to JSON clone
            }
        }
        if (typeof value === 'object') {
            try {
                return JSON.parse(JSON.stringify(value));
            } catch {
                return { ...value };
            }
        }
        return value;
    }

    #isEqual(a, b) {
        if (a === b) return true;
        if (typeof a !== typeof b) return false;
        if (typeof a === 'object' && a && b) {
            try {
                return JSON.stringify(a) === JSON.stringify(b);
            } catch {
                return false;
            }
        }
        return false;
    }
}
