import { renderAuthPanel } from '../ui/auth-panel.js';

const SUPPORTED_VIEWS = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'verify-email',
  'status'
]);

const FORM_VIEW_BY_ACTION = {
  login: 'login',
  register: 'register',
  'forgot-password': 'forgot-password',
  'reset-password': 'reset-password',
  'verify-email': 'verify-email',
  'resend-verification': 'verify-email'
};

const DEFAULT_CAPTCHA = {
  login: { required: false },
  register: { required: false },
  forgotPassword: { required: false },
  resetPassword: { required: false },
  resendVerification: { required: false }
};

function clone(value) {
  if (value === null || value === undefined) return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function captchaKeyFor(action) {
  if (action === 'forgot-password') return 'forgotPassword';
  if (action === 'reset-password') return 'resetPassword';
  if (action === 'resend-verification') return 'resendVerification';
  return action;
}

function formIdFor(action) {
  return `auth-ui.${action}`;
}

function withoutPrivateFields(values = {}) {
  const output = {};
  for (const [key, value] of Object.entries(values || {})) {
    if (key === 'website' || key.startsWith('_')) continue;
    output[key] = value;
  }
  return output;
}

function buildFieldPolicies(view) {
  const policies = {
    website: { honeypot: true, emit: false, persist: false, maxLength: 128 }
  };
  if (['login', 'register', 'reset-password'].includes(view)) {
    policies.password = { sensitive: true, persist: false, redact: true, maxLength: 4096 };
  }
  if (['reset-password', 'verify-email'].includes(view)) {
    policies.token = { sensitive: true, persist: false, redact: true, maxLength: 2048 };
  }
  if (['login', 'register', 'forgot-password', 'verify-email'].includes(view)) {
    policies.email = { trim: true, maxLength: 320 };
  }
  return policies;
}

function validateValues(view, values = {}) {
  const errors = {};
  if (['login', 'register', 'forgot-password'].includes(view) && !String(values.email || '').includes('@')) {
    errors.email = 'Valid email is required';
  }
  if (['login', 'register', 'reset-password'].includes(view) && !values.password) {
    errors.password = 'Password is required';
  }
  if (['reset-password', 'verify-email'].includes(view) && !values.token) {
    errors.token = 'Token is required';
  }
  return errors;
}

export class AuthUIService {
  constructor(eventBus, options = {}) {
    this.eventBus = eventBus;
    this.authService = options.authService || null;
    this.formService = options.formService || null;
    this.captchaService = options.captchaService || null;
    this.modalService = options.modalService || null;
    this.documentRef = options.documentRef || globalThis.document || null;
    this.config = { ...(options.config || {}) };
    this.container = null;
    this.listeners = [];
    this.subscriptions = [];
    this.registeredForms = new Set();
    this.state = {
      view: 'login',
      status: 'idle',
      authenticated: false,
      user: null,
      role: 'guest',
      message: '',
      error: '',
      errors: {},
      values: {}
    };
  }

  init({ authService, formService, captchaService, modalService, documentRef, config } = {}) {
    if (authService) this.authService = authService;
    if (formService) this.formService = formService;
    if (captchaService) this.captchaService = captchaService;
    if (modalService) this.modalService = modalService;
    if (documentRef) this.documentRef = documentRef;
    if (config) this.config = { ...this.config, ...config };
    this.subscriptions.forEach((cleanup) => cleanup?.());
    this.subscriptions = [];
    if (this.eventBus?.subscribe) {
      this.subscriptions.push(this.eventBus.subscribe('AUTH_SESSION_UPDATED', () => {
        this.#syncSessionState();
        this.#render();
      }));
      this.subscriptions.push(this.eventBus.subscribe('AUTH_LOGIN_FAILED', (payload = {}) => {
        this.state.error = payload.error || 'Authentication failed';
        this.#render();
      }));
    }
    this.#syncSessionState();
    return this;
  }

  mount(container, options = {}) {
    if (!container) {
      throw new Error('AuthUIService.mount requires a container');
    }
    this.container = container;
    if (options.view) {
      this.state.view = this.#normalizeView(options.view);
    }
    this.#ensureForm(this.state.view);
    this.#render();
    return this;
  }

  setView(view) {
    this.state.view = this.#normalizeView(view);
    this.state.error = '';
    this.state.errors = {};
    this.#ensureForm(this.state.view);
    this.#render();
    return this.getState();
  }

  async submit(view = this.state.view, values = {}) {
    const action = view || this.state.view;
    if (action === 'oauth') return this.startOAuth(values);
    if (action === 'logout') return this.logout(values);
    if (action === 'refresh-session') return this.refreshSession();

    const formView = FORM_VIEW_BY_ACTION[action];
    if (!formView) {
      throw new Error(`Unsupported auth-ui submit view: ${action}`);
    }

    const formId = formIdFor(action);
    this.#ensureForm(action, values);
    this.state.status = 'submitting';
    this.state.error = '';
    this.state.errors = {};
    this.state.values = {
      ...this.state.values,
      [formView]: { ...values }
    };
    this.#render();

    try {
      for (const [name, value] of Object.entries(values || {})) {
        this.formService?.updateField?.({ formId, name, value, validate: false });
      }

      const preflight = await this.formService?.submitForm?.({
        formId,
        metadata: {
          captcha: this.#captchaConfig(action)
        }
      });

      if (!preflight?.success) {
        this.state.status = 'idle';
        this.state.errors = preflight?.errors || { form: 'Auth form submission failed' };
        this.state.error = Object.values(this.state.errors).join(' ');
        this.#render();
        return { success: false, errors: this.state.errors };
      }

      const payload = withoutPrivateFields(values);
      const result = await this.#dispatchAuthAction(action, {
        ...payload,
        captcha: preflight.captcha || undefined
      });
      this.state.status = 'idle';
      this.state.message = this.#successMessage(action);
      this.state.error = '';
      this.#syncSessionState();
      if (['login', 'register'].includes(action)) {
        this.state.view = 'status';
      }
      this.#render();
      return result;
    } catch (error) {
      this.state.status = 'idle';
      this.state.error = error?.message || String(error);
      this.#render();
      return { success: false, error };
    }
  }

  async startOAuth(values = {}) {
    try {
      const result = await this.authService?.startOAuth?.(values);
      this.state.message = result?.authorizationUrl ? 'OAuth flow started.' : 'OAuth requested.';
      this.#render();
      return result;
    } catch (error) {
      this.state.error = error?.message || String(error);
      this.#render();
      return { success: false, error };
    }
  }

  async logout(values = {}) {
    const result = await this.authService?.logout?.(values);
    this.#syncSessionState();
    this.state.view = 'login';
    this.state.message = 'Signed out.';
    this.#render();
    return result;
  }

  async refreshSession() {
    const result = await this.authService?.refreshSession?.();
    this.#syncSessionState();
    this.#render();
    return result;
  }

  getState() {
    return clone(this.state);
  }

  destroy() {
    this.listeners.forEach((cleanup) => cleanup?.());
    this.listeners = [];
    this.subscriptions.forEach((cleanup) => cleanup?.());
    this.subscriptions = [];
    if (this.container) {
      this.container.replaceChildren();
    }
    this.container = null;
    this.registeredForms.clear();
  }

  #dispatchAuthAction(action, payload) {
    if (!this.authService) {
      throw new Error('AuthUIService requires authService');
    }
    if (action === 'login') return this.authService.login(payload);
    if (action === 'register') return this.authService.register(payload);
    if (action === 'forgot-password') return this.authService.forgotPassword(payload);
    if (action === 'reset-password') return this.authService.resetPassword(payload);
    if (action === 'verify-email') return this.authService.verifyEmail(payload);
    if (action === 'resend-verification') return this.authService.resendVerification(payload);
    throw new Error(`Unsupported auth action: ${action}`);
  }

  #ensureForm(action, initialValues = {}) {
    const formView = FORM_VIEW_BY_ACTION[action] || action;
    if (!SUPPORTED_VIEWS.has(formView) || formView === 'status' || !this.formService?.registerForm) {
      return;
    }
    const formId = formIdFor(action);
    const validationView = action === 'resend-verification' ? 'forgot-password' : formView;
    this.formService.registerForm({
      formId,
      initialValues: {
        website: '',
        ...initialValues
      },
      schema: (values) => validateValues(validationView, values),
      metadata: {
        trustLevel: 'public-network',
        persist: false,
        captcha: this.#captchaConfig(action)
      },
      fieldPolicies: buildFieldPolicies(formView),
      sensitiveFields: ['password', 'token'],
      autoSave: false
    });
    this.registeredForms.add(formId);
  }

  #captchaConfig(action) {
    const config = {
      ...DEFAULT_CAPTCHA,
      ...(this.config?.captcha || {})
    };
    const value = config[captchaKeyFor(action)] || { required: false };
    return {
      ...value,
      action: value.action || action
    };
  }

  #normalizeView(view) {
    return SUPPORTED_VIEWS.has(view) ? view : 'login';
  }

  #syncSessionState() {
    const user = this.authService?.getUser?.() || null;
    this.state.user = user;
    this.state.authenticated = Boolean(this.authService?.isAuthenticated?.());
    this.state.role = this.authService?.getRole?.() || user?.role || 'guest';
  }

  #render() {
    if (!this.container || !this.documentRef) return;
    this.listeners.forEach((cleanup) => cleanup?.());
    this.listeners = [];
    const panel = renderAuthPanel({ state: this.state, documentRef: this.documentRef });
    this.container.replaceChildren(panel);
    this.#bindPanel(panel);
  }

  #bindPanel(panel) {
    const clickHandler = (event) => {
      const viewButton = event.target.closest?.('[data-auth-ui-view]');
      if (viewButton) {
        this.setView(viewButton.dataset.authUiView);
        return;
      }
      const actionButton = event.target.closest?.('[data-auth-ui-action]');
      if (!actionButton) return;
      const action = actionButton.dataset.authUiAction;
      if (action === 'resend-verification') {
        const form = panel.querySelector('[data-auth-ui-form="verify-email"]');
        this.submit(action, Object.fromEntries(new FormData(form))).catch(() => null);
        return;
      }
      this.submit(action, action === 'oauth' ? { provider: this.config.oauthProvider || 'default' } : {}).catch(() => null);
    };
    const submitHandler = (event) => {
      const form = event.target.closest?.('[data-auth-ui-form]');
      if (!form) return;
      event.preventDefault();
      this.submit(form.dataset.authUiForm, Object.fromEntries(new FormData(form))).catch(() => null);
    };
    panel.addEventListener('click', clickHandler);
    panel.addEventListener('submit', submitHandler);
    this.listeners.push(() => panel.removeEventListener('click', clickHandler));
    this.listeners.push(() => panel.removeEventListener('submit', submitHandler));
  }

  #successMessage(action) {
    if (action === 'forgot-password') return 'Password reset request sent.';
    if (action === 'reset-password') return 'Password reset completed.';
    if (action === 'verify-email') return 'Email verified.';
    if (action === 'resend-verification') return 'Verification request sent.';
    if (action === 'register') return 'Account created.';
    return 'Signed in.';
  }
}

export function createAuthUIService(eventBus, options = {}) {
  return new AuthUIService(eventBus, options);
}
