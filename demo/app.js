import { EventBus } from '../src/runtime/EventBus.js';
import { Contracts } from '../src/runtime/Contracts.js';
import { createAuthService } from '../src/modules/auth/index.js';
import { createAuthUIService } from '../src/modules/auth-ui/index.js';
import { FormManagementService } from '../src/modules/form-management/services/FormManagementService.js';
import { createNotificationsService } from '../src/modules/notifications/index.js';
import { initNotificationsCenter } from '../src/modules/notifications/ui/notifications-center.js';
import { createShareService } from '../src/modules/share/index.js';
import { createFileUploadService } from '../src/modules/file-upload/index.js';
import { createFileUploadDropZone } from '../src/modules/file-upload/ui/drop-zone.js';
import { createFileUploadList } from '../src/modules/file-upload/ui/file-list.js';
import { initToastSystem } from '../src/ui/components/toast/toast.js';
import { initTodoApp } from './todo-app.js';

const STORAGE_KEY = 'csma.todo-app';
const LEGACY_KEYS = ['todo-items', 'todos', 'todo-app', 'todo-app:v2'];
const FILTERS = ['all', 'active', 'completed'];
const FALLBACK_SEED = [
  { title: 'Draft copy for marketing site', completed: false, priority: 'medium' },
  { title: 'Wireframe dashboard empty states', completed: true, priority: 'low' },
  { title: 'Prepare accessibility checklist', completed: false, priority: 'high' }
];
const DEMO_AUTH_KEY = 'csma.demo.auth.session';

const eventBus = new EventBus();
eventBus.contracts = Contracts;

const THEMES = ['light', 'dark', 'contrast'];
const THEME_LABELS = { light: 'Light', dark: 'Dark', contrast: 'Contrast' };

function getStoredTheme() {
  try { return window.localStorage.getItem('csma-theme'); } catch { return null; }
}

function setStoredTheme(theme) {
  try { window.localStorage.setItem('csma-theme', theme); } catch {}
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = THEMES[0];
  document.documentElement.dataset.theme = theme;
  setStoredTheme(theme);
  return theme;
}

function syncToggle(btn) {
  const current = document.documentElement.dataset.theme || THEMES[0];
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  btn.dataset.themeActive = current;
  btn.dataset.themeNext = next;
  btn.setAttribute('aria-label', `Switch to ${next} theme`);
  const label = btn.querySelector('[data-theme-label]');
  if (label) label.textContent = `Theme: ${THEME_LABELS[current]}`;
}

function bindThemeToggles() {
  applyTheme(getStoredTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.themeNext;
      applyTheme(next);
      document.querySelectorAll('[data-theme-toggle]').forEach(syncToggle);
    });
    syncToggle(btn);
  });
}

function createTodoService(bus) {
  let filter = 'all';
  let todos = loadTodos();
  let activity = [];

  const subs = [
    bus.subscribe('INTENT_TODO_CREATE', handleCreate),
    bus.subscribe('INTENT_TODO_TOGGLE', handleToggle),
    bus.subscribe('INTENT_TODO_DELETE', handleDelete),
    bus.subscribe('INTENT_TODO_UPDATE', handleUpdate),
    bus.subscribe('INTENT_TODO_CLEAR_COMPLETED', handleClearCompleted),
    bus.subscribe('INTENT_TODO_FILTER', handleFilterChange),
  ];

  emitChange('init');

  function handleCreate(payload) {
    const title = sanitize(payload?.title);
    if (!title) return;
    const now = Date.now();
    todos = [{ id: uid(now), title, completed: false, createdAt: now, updatedAt: now, priority: 'medium' }, ...todos];
    persist();
    track(`${title} added`);
    emitChange('created');
  }

  function handleToggle(payload) {
    if (!payload?.id) return;
    let changed = null;
    let nextCompleted = false;
    todos = todos.map((t) => {
      if (t.id !== payload.id) return t;
      changed = t.title;
      nextCompleted = !t.completed;
      return { ...t, completed: nextCompleted, updatedAt: Date.now() };
    });
    if (!changed) return;
    persist();
    track(`${changed} marked ${nextCompleted ? 'done' : 'active'}`);
    emitChange('toggled');
  }

  function handleDelete(payload) {
    if (!payload?.id) return;
    const target = todos.find((t) => t.id === payload.id);
    if (!target) return;
    todos = todos.filter((t) => t.id !== payload.id);
    persist();
    track(`${target.title} removed`);
    emitChange('deleted');
  }

  function handleUpdate(payload) {
    if (!payload?.id) return;
    const nextTitle = sanitize(payload.title);
    if (!nextTitle) return;
    let didUpdate = false;
    todos = todos.map((t) => {
      if (t.id !== payload.id) return t;
      didUpdate = true;
      return { ...t, title: nextTitle, updatedAt: Date.now() };
    });
    if (!didUpdate) return;
    persist();
    track(`${nextTitle} updated`);
    emitChange('updated');
  }

  function handleClearCompleted() {
    const removed = todos.filter((t) => t.completed).length;
    if (!removed) return;
    todos = todos.filter((t) => !t.completed);
    persist();
    track(`${removed} completed tasks cleared`);
    emitChange('clear-completed');
  }

  function handleFilterChange(payload) {
    if (!payload?.filter || !FILTERS.includes(payload.filter)) return;
    filter = payload.filter;
    emitChange('filter-changed');
  }

  function emitChange(reason) {
    const stats = buildStats(todos);
    bus.publish('TODO_STATE_CHANGED', {
      todos: [...todos],
      filter,
      reason,
      stats,
      insights: buildInsights(todos, stats),
      activity: [...activity],
      timestamp: Date.now(),
    });
  }

  function persist() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); }
    catch (error) { console.warn('[todo] persist failed', error); }
  }

  function track(message) {
    activity = [{ message, timestamp: Date.now() }, ...activity].slice(0, 6);
  }

  return function teardown() {
    subs.forEach((fn) => typeof fn === 'function' && fn());
  };
}

function loadTodos() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalize(parsed);
      }
    } catch {}
  }
  return normalize(FALLBACK_SEED);
}

function normalize(items) {
  const now = Date.now();
  return items.map((item, index) => ({
    id: item.id || uid(now + '-' + index),
    title: sanitize(item.title) || `Todo ${index + 1}`,
    completed: Boolean(item.completed),
    createdAt: item.createdAt || now - index * 3600000,
    updatedAt: item.updatedAt || now - index * 1800000,
    priority: item.priority || ['low', 'medium', 'high'][index % 3],
  }));
}

function buildStats(todos) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  return {
    total,
    completed,
    active: total - completed,
    completionRate: total ? Math.round((completed / total) * 100) : 0
  };
}

function buildInsights(todos, stats) {
  const focus = todos.find((t) => !t.completed);
  const last = [...todos].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  return {
    completionRate: stats.completionRate,
    focusTask: focus?.title || 'All caught up',
    lastUpdated: last?.updatedAt || null
  };
}

function sanitize(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}

function uid(seed) {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {}
  return 'todo-' + (seed || Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function safeJsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

function safeEmptyResponse() {
  return new Response(null, { status: 204 });
}

function readDemoSession() {
  try {
    const raw = window.localStorage.getItem(DEMO_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDemoSession(session) {
  try {
    if (!session) {
      window.localStorage.removeItem(DEMO_AUTH_KEY);
      return;
    }
    window.localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(session));
  } catch {}
}

function installDemoAuthBackend() {
  const nativeFetch = globalThis.fetch?.bind(globalThis);

  globalThis.fetch = async (input, init = {}) => {
    const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.origin);

    if (!requestUrl.pathname.startsWith('/demo-auth/')) {
      if (!nativeFetch) {
        throw new Error(`Unhandled fetch request for ${requestUrl.pathname}`);
      }
      return nativeFetch(input, init);
    }

    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    const session = readDemoSession();

    if (requestUrl.pathname === '/demo-auth/me' && method === 'GET') {
      return safeJsonResponse(session || {});
    }

    if (requestUrl.pathname === '/demo-auth/login' && method === 'POST') {
      const nextSession = {
        user: {
          id: 'demo-user',
          name: 'CSMA Demo User',
          email: body.email || 'demo@csma.dev',
          role: 'admin'
        },
        sessionId: `sess-${Date.now()}`,
        accessToken: 'demo.header.payload',
        strategy: 'hybrid'
      };
      writeDemoSession(nextSession);
      return safeJsonResponse(nextSession);
    }

    if (requestUrl.pathname === '/demo-auth/register' && method === 'POST') {
      const nextSession = {
        user: {
          id: 'demo-user',
          name: body.name || 'New Demo User',
          email: body.email || 'demo@csma.dev',
          role: 'user'
        },
        sessionId: `sess-${Date.now()}`,
        strategy: 'cookie'
      };
      writeDemoSession(nextSession);
      return safeJsonResponse(nextSession);
    }

    if (requestUrl.pathname === '/demo-auth/forgot-password' && method === 'POST') {
      return safeJsonResponse({
        requestId: `forgot-${Date.now()}`,
        email: body.email,
        message: 'Demo reset request accepted'
      });
    }

    if (requestUrl.pathname === '/demo-auth/reset-password' && method === 'POST') {
      return safeJsonResponse({
        requestId: `reset-${Date.now()}`,
        message: 'Demo password reset accepted'
      });
    }

    if (requestUrl.pathname === '/demo-auth/verify-email' && method === 'POST') {
      return safeJsonResponse({
        requestId: `verify-${Date.now()}`,
        email: body.email,
        message: 'Demo email verified'
      });
    }

    if (requestUrl.pathname === '/demo-auth/resend-verification' && method === 'POST') {
      return safeJsonResponse({
        requestId: `resend-${Date.now()}`,
        email: body.email,
        message: 'Demo verification resent'
      });
    }

    if (requestUrl.pathname === '/demo-auth/logout' && method === 'POST') {
      writeDemoSession(null);
      return safeEmptyResponse();
    }

    if (requestUrl.pathname === '/demo-auth/refresh' && method === 'POST') {
      return safeJsonResponse(session || {});
    }

    if (requestUrl.pathname === '/demo-auth/oauth/start' && method === 'POST') {
      return safeJsonResponse({
        authorizationUrl: `${window.location.origin}/demo/#oauth-demo`,
        state: body.state || `oauth-${Date.now()}`
      });
    }

    if (requestUrl.pathname === '/demo-auth/oauth/callback' && method === 'POST') {
      const nextSession = {
        user: {
          id: 'oauth-user',
          name: 'OAuth Demo User',
          email: 'oauth@csma.dev',
          role: 'staff'
        },
        sessionId: `oauth-${Date.now()}`,
        strategy: 'oauth',
        provider: body.provider || 'github'
      };
      writeDemoSession(nextSession);
      return safeJsonResponse(nextSession);
    }

    return safeJsonResponse({ error: 'Not found' }, 404);
  };

  return () => {
    globalThis.fetch = nativeFetch;
  };
}

function bindAuthDemo(bus) {
  const mount = document.querySelector('[data-auth-ui-demo]');
  const auth = createAuthService(bus, {
    securityProfile: 'development',
    baseUrl: window.location.origin,
    strategy: 'hybrid',
    storage: {
      accessToken: 'sessionStorage',
      session: 'localStorage',
      keyPrefix: 'csma.demo.auth'
    },
    endpoints: {
      register: '/demo-auth/register',
      login: '/demo-auth/login',
      logout: '/demo-auth/logout',
      session: '/demo-auth/me',
      refresh: '/demo-auth/refresh',
      forgotPassword: '/demo-auth/forgot-password',
      resetPassword: '/demo-auth/reset-password',
      verifyEmail: '/demo-auth/verify-email',
      resendVerification: '/demo-auth/resend-verification',
      oauthStart: '/demo-auth/oauth/start',
      oauthCallback: '/demo-auth/oauth/callback'
    }
  });
  const form = new FormManagementService(bus);
  form.init();
  const authUI = createAuthUIService(bus);
  authUI.init({
    authService: auth,
    formService: form,
    documentRef: document,
    config: {
      oauthProvider: 'github',
      captcha: {
        register: { required: false },
        forgotPassword: { required: false },
        resendVerification: { required: false }
      }
    }
  });

  const oauthStart = auth.startOAuth.bind(auth);
  auth.startOAuth = async (options = {}) => {
    const started = await oauthStart(options);
    await auth.handleOAuthCallback({
      code: 'demo-code',
      state: started.state,
      provider: options.provider || 'github'
    }).catch(() => null);
    return started;
  };

  auth.init().then(() => authUI.mount(mount, { view: 'login' }));

  return {
    auth,
    authUI,
    destroy() {
      authUI.destroy();
      form.destroy();
      auth.destroy();
    }
  };
}

function bindNotificationsDemo(bus) {
  const status = document.querySelector('[data-notifications-status]');
  const requestButton = document.querySelector('[data-notifications-request]');
  const enqueueButton = document.querySelector('[data-notifications-enqueue]');
  const warningButton = document.querySelector('[data-notifications-warning]');
  const notifications = createNotificationsService(bus, {
    consent: {
      hasConsent: () => true
    }
  });

  const renderStatus = () => {
    const state = notifications.getState();
    const lines = status.querySelectorAll('strong, span');
    lines[0].textContent = state.centerOpen ? 'Center open' : 'Center idle';
    lines[1].textContent = `${state.unreadCount} unread notifications. Permission: ${state.permission.permission}.`;
  };

  const centerCleanup = initNotificationsCenter(notifications, document);
  const subscriptions = [
    bus.subscribe('NOTIFICATIONS_STATE_CHANGED', renderStatus)
  ];

  requestButton.addEventListener('click', () => notifications.requestPermission('demo').catch(() => null));
  enqueueButton.addEventListener('click', () => {
    notifications.enqueue({
      title: 'Deploy complete',
      body: 'All optional Phase 1 modules are loaded in the demo.',
      type: 'success',
      source: 'demo',
      timestamp: Date.now()
    });
  });
  warningButton.addEventListener('click', () => {
    notifications.enqueue({
      title: 'Consent review',
      body: 'Notifications stay explicit until the user requests permission.',
      type: 'warning',
      source: 'demo',
      timestamp: Date.now()
    });
  });

  renderStatus();

  return {
    notifications,
    destroy() {
      subscriptions.forEach((unsubscribe) => unsubscribe?.());
      centerCleanup();
      notifications.destroy();
    }
  };
}

function bindShareDemo(bus) {
  const textInput = document.querySelector('[data-share-text]');
  const button = document.querySelector('[data-share-trigger]');
  const status = document.querySelector('[data-share-status]');
  const share = createShareService(bus, {
    toastIntent: 'INTENT_TOAST_SHOW'
  });

  const renderResult = (headline, detail) => {
    const lines = status.querySelectorAll('strong, span');
    lines[0].textContent = headline;
    lines[1].textContent = detail;
  };

  button.addEventListener('click', async () => {
    const result = await share.request({
      title: 'CSMA Demo',
      text: textInput.value,
      url: window.location.href,
      source: 'demo',
      timestamp: Date.now()
    });

    if (result.ok) {
      renderResult('Shared', `Completed through ${result.transport}.`);
      return;
    }
    renderResult('Share failed', result.message);
  });

  return {
    share,
    destroy() {
      share.destroy();
    }
  };
}

function createUploadStorage() {
  return {
    getItem(key) {
      return window.localStorage.getItem(key);
    },
    setItem(key, value) {
      window.localStorage.setItem(key, value);
    },
    removeItem(key) {
      window.localStorage.removeItem(key);
    }
  };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function registerDemoServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(null);
  }

  return navigator.serviceWorker.register('/sw.js', {
    type: 'module'
  }).catch((error) => {
    console.warn('[demo] service worker registration failed', error);
    return null;
  });
}

function bindUploadDemo(bus) {
  const dropZoneMount = document.querySelector('[data-upload-dropzone]');
  const listMount = document.querySelector('[data-upload-list]');
  const upload = createFileUploadService(bus, {
    storage: createUploadStorage(),
    chunkSize: 24 * 1024,
    transport: {
      async uploadChunk(payload) {
        await wait(80);
        return {
          uploaded: true,
          chunkIndex: payload.chunkIndex,
          totalChunks: payload.totalChunks
        };
      }
    }
  });

  const renderList = () => {
    listMount.replaceChildren(
      createFileUploadList(upload, {
        emptyLabel: 'No demo uploads yet'
      })
    );
  };

  const dropZone = createFileUploadDropZone(upload, {
    root: document,
    title: 'Drop files into the demo uploader',
    description: 'Progress events and resumable checkpoints are produced by the real module service.',
    buttonLabel: 'Browse Files',
    uploadOptions: {
      chunkSize: 24 * 1024
    }
  });

  dropZoneMount.replaceChildren(dropZone);
  renderList();

  const subscriptions = [
    bus.subscribe('FILE_UPLOAD_STARTED', renderList),
    bus.subscribe('FILE_UPLOAD_PROGRESS', renderList),
    bus.subscribe('FILE_UPLOAD_COMPLETED', renderList),
    bus.subscribe('FILE_UPLOAD_FAILED', renderList),
    bus.subscribe('FILE_UPLOAD_PAUSED', renderList),
    bus.subscribe('FILE_UPLOAD_RESUMED', renderList),
    bus.subscribe('FILE_UPLOAD_CANCELLED', renderList),
    bus.subscribe('FILE_REMOVED', renderList)
  ];

  upload.init();

  return {
    fileUpload: upload,
    destroy() {
      subscriptions.forEach((unsubscribe) => unsubscribe?.());
      upload.destroy();
    }
  };
}

bindThemeToggles();
const restoreFetch = installDemoAuthBackend();
const toastCleanup = initToastSystem(eventBus);
initTodoApp(eventBus);
const teardownService = createTodoService(eventBus);
const authDemo = bindAuthDemo(eventBus);
const notificationsDemo = bindNotificationsDemo(eventBus);
const shareDemo = bindShareDemo(eventBus);
const uploadDemo = bindUploadDemo(eventBus);
const serviceWorkerReady = registerDemoServiceWorker();

window.csma = {
  ...(window.csma || {}),
  eventBus,
  auth: authDemo.auth,
  notifications: notificationsDemo.notifications,
  share: shareDemo.share,
  fileUpload: uploadDemo.fileUpload,
  serviceWorkerReady,
  teardown() {
    authDemo.destroy();
    notificationsDemo.destroy();
    shareDemo.destroy();
    uploadDemo.destroy();
    toastCleanup();
    teardownService();
    restoreFetch();
  }
};

window.addEventListener('beforeunload', () => {
  window.csma?.teardown?.();
});
