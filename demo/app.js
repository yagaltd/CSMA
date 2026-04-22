import { EventBus } from '../src/runtime/EventBus.js';
import { initTodoApp } from './todo-app.js';

const STORAGE_KEY = 'csma.todo-app';
const LEGACY_KEYS = ['todo-items', 'todos', 'todo-app', 'todo-app:v2'];
const FILTERS = ['all', 'active', 'completed'];
const FALLBACK_SEED = [
  { title: 'Draft copy for marketing site', completed: false, priority: 'medium' },
  { title: 'Wireframe dashboard empty states', completed: true, priority: 'low' },
  { title: 'Prepare accessibility checklist', completed: false, priority: 'high' }
];

/* ── EventBus ──────────────────────────────────────────────── */
const eventBus = new EventBus();

/* ── Theme toggle ──────────────────────────────────────────── */
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

/* ── Todo Service (state + persistence) ────────────────────── */
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
    catch (e) { console.warn('[todo] persist failed', e); }
  }

  function track(msg) {
    activity = [{ message: msg, timestamp: Date.now() }, ...activity].slice(0, 6);
  }

  return function teardown() {
    subs.forEach((fn) => typeof fn === 'function' && fn());
  };
}

/* ── Helpers ───────────────────────────────────────────────── */
function loadTodos() {
  for (const key of [STORAGE_KEY, ...LEGACY_KEYS]) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalize(parsed);
      }
    } catch { /* ignore */ }
  }
  return normalize(FALLBACK_SEED);
}

function normalize(items) {
  const now = Date.now();
  return items.map((item, i) => ({
    id: item.id || uid(now + '-' + i),
    title: sanitize(item.title) || `Todo ${i + 1}`,
    completed: Boolean(item.completed),
    createdAt: item.createdAt || now - i * 3600000,
    updatedAt: item.updatedAt || now - i * 1800000,
    priority: item.priority || ['low', 'medium', 'high'][i % 3],
  }));
}

function buildStats(todos) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  return { total, completed, active: total - completed, completionRate: total ? Math.round((completed / total) * 100) : 0 };
}

function buildInsights(todos, stats) {
  const focus = todos.find((t) => !t.completed);
  const last = [...todos].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  return { completionRate: stats.completionRate, focusTask: focus?.title || 'All caught up', lastUpdated: last?.updatedAt || null };
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

/* ── Boot ──────────────────────────────────────────────────── */
bindThemeToggles();
initTodoApp(eventBus);      // subscribe to state changes FIRST
const teardownService = createTodoService(eventBus);  // THEN publish initial state

// Expose for debugging
window.csma = { eventBus, teardown: teardownService };

window.addEventListener('beforeunload', teardownService);
