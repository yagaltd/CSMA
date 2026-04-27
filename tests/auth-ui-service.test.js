// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { AuthUIService } from '../src/modules/auth-ui/services/AuthUIService.js';
import { FormManagementService } from '../src/modules/form-management/services/FormManagementService.js';

class MockEventBus {
  constructor() {
    this.publish = vi.fn();
    this.subscribe = vi.fn(() => () => {});
  }
}

function createAuth(overrides = {}) {
  return {
    getUser: vi.fn(() => null),
    isAuthenticated: vi.fn(() => false),
    getRole: vi.fn(() => 'guest'),
    login: vi.fn(async () => ({ success: true, user: { id: 'u-1' }, authenticated: true })),
    register: vi.fn(async () => ({ success: true, user: { id: 'u-2' }, authenticated: true })),
    forgotPassword: vi.fn(async () => ({ success: true })),
    resetPassword: vi.fn(async () => ({ success: true })),
    verifyEmail: vi.fn(async () => ({ success: true })),
    resendVerification: vi.fn(async () => ({ success: true })),
    startOAuth: vi.fn(async () => ({ success: true, state: 'oauth-state' })),
    logout: vi.fn(async () => ({ success: true })),
    refreshSession: vi.fn(async () => ({ success: true })),
    ...overrides
  };
}

function createService({ auth = createAuth(), captcha, config } = {}) {
  const eventBus = new MockEventBus();
  const form = new FormManagementService(eventBus);
  form.init({ captchaService: captcha });
  const service = new AuthUIService(eventBus);
  service.init({ authService: auth, formService: form, captchaService: captcha, documentRef: document, config });
  return { service, auth, form };
}

describe('AuthUIService', () => {
  it('mounts, switches views, and destroys semantic DOM', () => {
    const { service } = createService();
    const container = document.createElement('div');

    service.mount(container, { view: 'login' });
    expect(container.querySelector('[data-auth-ui-panel]')).toBeTruthy();
    expect(container.querySelector('[data-auth-ui-form="login"]')).toBeTruthy();

    service.setView('register');
    expect(container.querySelector('[data-auth-ui-form="register"]')).toBeTruthy();

    service.destroy();
    expect(container.childElementCount).toBe(0);
  });

  it('registers auth forms with sensitive fields and honeypot policy', async () => {
    const { service, form } = createService();
    service.mount(document.createElement('div'), { view: 'reset-password' });

    await service.submit('reset-password', {
      token: 'reset-token',
      password: 'secret',
      website: ''
    });

    const state = form.getFormState('auth-ui.reset-password');
    expect(state.values.token).toBe('[REDACTED]');
    expect(state.values.password).toBe('[REDACTED]');
    expect(state.values.website).toBeUndefined();
  });

  it('rejects honeypot submissions before auth dispatch', async () => {
    const auth = createAuth();
    const { service } = createService({ auth });

    const result = await service.submit('login', {
      email: 'demo@example.com',
      password: 'secret',
      website: 'bot'
    });

    expect(result.success).toBe(false);
    expect(result.errors.honeypot).toBeDefined();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('rejects CAPTCHA-required submissions when CAPTCHA is unavailable', async () => {
    const auth = createAuth();
    const { service } = createService({
      auth,
      config: {
        captcha: {
          register: { required: true }
        }
      }
    });

    const result = await service.submit('register', {
      name: 'Ada',
      email: 'ada@example.com',
      password: 'secret',
      website: ''
    });

    expect(result.success).toBe(false);
    expect(result.errors.captcha).toBeDefined();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('dispatches auth methods after successful form preflight', async () => {
    const captcha = {
      getToken: vi.fn(async () => 'captcha-token'),
      getAdapterInfo: vi.fn(() => ({ id: 'captcha.test', provider: 'test' }))
    };
    const auth = createAuth({
      getUser: vi.fn(() => ({ id: 'u-2', email: 'ada@example.com', role: 'user' })),
      isAuthenticated: vi.fn(() => true),
      getRole: vi.fn(() => 'user')
    });
    const { service } = createService({
      auth,
      captcha,
      config: { captcha: { register: { required: true } } }
    });

    const result = await service.submit('register', {
      email: 'ada@example.com',
      password: 'secret',
      website: ''
    });

    expect(result.success).toBe(true);
    expect(auth.register).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ada@example.com',
      password: 'secret',
      captcha: expect.objectContaining({ token: 'captcha-token' })
    }));
    expect(service.getState()).toMatchObject({ view: 'status', authenticated: true });
  });

  it('renders auth errors and supports OAuth and logout actions', async () => {
    const auth = createAuth({
      login: vi.fn(async () => {
        throw new Error('Invalid credentials');
      })
    });
    const { service } = createService({ auth });
    const container = document.createElement('div');
    service.mount(container);

    const failed = await service.submit('login', {
      email: 'demo@example.com',
      password: 'bad',
      website: ''
    });
    expect(failed.success).toBe(false);
    expect(container.textContent).toContain('Invalid credentials');

    await service.submit('oauth', { provider: 'github' });
    await service.submit('logout', { reason: 'test' });

    expect(auth.startOAuth).toHaveBeenCalledWith({ provider: 'github' });
    expect(auth.logout).toHaveBeenCalledWith({ reason: 'test' });
  });
});
