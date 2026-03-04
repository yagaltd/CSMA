import EventBus from '../../src/runtime/EventBus.js';
import { Contracts as BaseContracts, contract } from '../../src/runtime/Contracts.js';
import { LogAccumulator } from '../../src/runtime/LogAccumulator.js';
import { object, string, number, boolean, enums, optional, size, array } from '../../src/runtime/validation/index.js';
import { createTodoService } from './services/TodoService.js';

const FILTERS = ['all', 'active', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];
const THEME_KEY = 'csma.todo-app.theme';

const TodoContracts = {
  INTENT_TODO_CREATE: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User wants to create a todo'
  }, object({
    title: size(string(), 1, 120),
    id: optional(string()),
    completed: optional(boolean()),
    priority: optional(enums(PRIORITIES)),
    timestamp: number()
  })),

  INTENT_TODO_TOGGLE: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User toggles a todo'
  }, object({
    id: string(),
    timestamp: number()
  })),

  INTENT_TODO_DELETE: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User removes a todo'
  }, object({
    id: string(),
    timestamp: number()
  })),

  INTENT_TODO_UPDATE: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User edits a todo title'
  }, object({
    id: string(),
    title: size(string(), 1, 120),
    timestamp: number()
  })),

  INTENT_TODO_CLEAR_COMPLETED: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User clears completed todos'
  }, object({
    timestamp: number()
  })),

  INTENT_TODO_FILTER: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User changes todo filter'
  }, object({
    filter: enums(FILTERS),
    timestamp: number()
  })),

  TODO_STATE_CHANGED: contract({
    version: 1,
    type: 'event',
    owner: 'todo-service',
    description: 'Todo state diff emitted'
  }, object({
    todos: array(object({
      id: string(),
      title: size(string(), 1, 120),
      completed: boolean(),
      createdAt: number(),
      updatedAt: number(),
      priority: optional(enums(PRIORITIES))
    })),
    filter: enums(FILTERS),
    stats: object({
      total: number(),
      active: number(),
      completed: number(),
      completionRate: number()
    }),
    insights: object({
      completionRate: number(),
      focusTask: string(),
      lastUpdated: optional(number())
    }),
    activity: array(object({
      message: string(),
      timestamp: number()
    })),
    reason: string(),
    timestamp: number()
  }))
};

const eventBus = new EventBus();
eventBus.contracts = { ...BaseContracts, ...TodoContracts };
const LOG_STORAGE_KEY = 'csma.todo-app.logs';

// Use global LogAccumulator from main.js, wait for it to be available
const getLogAccumulator = () => {
  if (window.csma?.logAccumulator) {
    return window.csma.logAccumulator;
  }
  // Fallback for testing
  return new LogAccumulator(eventBus);
};

const logAccumulator = getLogAccumulator();

// Configure todo-app specific settings if needed
if (window.csma?.logAccumulator) {
  // Already configured in main.js
} else {
  // Fallback initialization for standalone usage
  const apiBaseUrl = resolveApiBaseUrl();
  const logEndpoint = buildLogEndpoint(apiBaseUrl);
  logAccumulator.init({
    endpoint: logEndpoint,
    authEndpoint: logEndpoint.replace('/logs/batch', '/auth/guest'),
    source: 'csma-todo-example',
    appVersion: 'dev',
    maxBatchSize: 5,
    serverBatchLimit: 50,
    // Auth provider for SSMA backend
    authProvider: () => localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token')
  });
}

eventBus.subscribe('LOG_ENTRY', (entry) => {
  try {
    const existing = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
    existing.push(entry);
    if (existing.length > 100) {
      existing.shift();
    }
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(existing));
  } catch (error) {
    console.warn('[TodoApp] Unable to persist log entry', error);
  }
});

function resolveApiBaseUrl() {
  const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL || '').trim();
  if (envUrl) return envUrl;

  if (typeof window !== 'undefined') {
    const globalUrl = window.__CSMA_API_URL || window.csma?.config?.apiBaseUrl;
    if (globalUrl) return globalUrl;
  }

  if (typeof window !== 'undefined' && window.location && window.location.hostname === 'localhost') {
    // Explicitly point to our running SSMA server
    return 'http://localhost:5050';
  }

  return '';
}

function buildLogEndpoint(baseUrl) {
  if (!baseUrl) return '/logs/batch';
  return `${baseUrl.replace(/\/$/, '')}/logs/batch`;
}

const appRoot = document.querySelector('[data-todo-app]');
const form = appRoot?.querySelector('[data-todo-form]');
const list = appRoot?.querySelector('[data-todo-list]');
const filters = appRoot?.querySelector('.todo-filters');
const statsNodes = appRoot?.querySelectorAll('[data-stat]');
const logList = appRoot?.querySelector('[data-todo-log]');
const template = document.getElementById('todo-item-template');
const boardTemplate = document.getElementById('todo-board-template');
const themeToggle = document.querySelector('[data-theme-toggle]');
const themeLabel = document.querySelector('[data-theme-label]');
const editDialog = document.querySelector('[data-edit-dialog]');
const dialogForm = editDialog?.querySelector('[data-dialog-form]');
const dialogInput = editDialog?.querySelector('[data-dialog-input]');
const dialogClose = editDialog?.querySelector('[data-dialog-close]');
const dialogCancel = editDialog?.querySelector('[data-dialog-cancel]');
const dialogToggle = editDialog?.querySelector('[data-dialog-toggle]');
const dialogDelete = editDialog?.querySelector('[data-dialog-delete]');

const storage = createStorage();
const prefersDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const storedTheme = storage.getItem(THEME_KEY);
const initialTheme = storedTheme || (prefersDark?.matches ? 'dark' : 'light');
let editingTodoId = null;
let latestState = null;

setTheme(initialTheme, Boolean(storedTheme));
themeToggle?.addEventListener('click', toggleTheme);
if (prefersDark) {
  const handleSystemTheme = (event) => {
    if (!storage.getItem(THEME_KEY)) {
      setTheme(event.matches ? 'dark' : 'light');
    }
  };
  if (typeof prefersDark.addEventListener === 'function') {
    prefersDark.addEventListener('change', handleSystemTheme);
  } else if (typeof prefersDark.addListener === 'function') {
    prefersDark.addListener(handleSystemTheme);
  }
}

if (dialogForm) {
  dialogForm.addEventListener('submit', handleDialogSubmit);
}
dialogClose?.addEventListener('click', () => closeEditDialog());
dialogCancel?.addEventListener('click', () => closeEditDialog());
dialogToggle?.addEventListener('change', handleDialogToggle);
dialogDelete?.addEventListener('click', handleDialogDelete);
editDialog?.addEventListener('cancel', (event) => {
  event.preventDefault();
  closeEditDialog();
});

if (appRoot && form && list && filters) {
  appRoot.dataset.view = appRoot.dataset.view || 'list';
  form.addEventListener('submit', handleSubmit);
  filters.addEventListener('click', handleFilterClick);
  list.addEventListener('click', handleListAction);
  list.addEventListener('change', handleCheckboxToggle);

  const viewToggles = appRoot.querySelectorAll('[data-view-toggle]');
  viewToggles.forEach((btn) => btn.addEventListener('click', () => handleViewToggle(btn, viewToggles)));
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const title = formData.get('title');
  if (!title) return;
  eventBus.publish('INTENT_TODO_CREATE', {
    title,
    timestamp: Date.now()
  });
  logTodoAction('create', { title });
  form.reset();
}

function handleFilterClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'clear-completed') {
    eventBus.publish('INTENT_TODO_CLEAR_COMPLETED', { timestamp: Date.now() });
    logTodoAction('clear-completed');
    return;
  }
  const filter = button.dataset.filter;
  if (!FILTERS.includes(filter)) return;
  eventBus.publish('INTENT_TODO_FILTER', { filter, timestamp: Date.now() });
  logTodoAction('filter-change', { filter });
}

function handleListAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const item = button.closest('[data-id]');
  if (!item) return;
  const id = item.dataset.id;
  if (button.dataset.action === 'delete') {
    eventBus.publish('INTENT_TODO_DELETE', { id, timestamp: Date.now() });
    logTodoAction('delete', { id });
  } else if (button.dataset.action === 'edit') {
    openEditDialog(id);
    logTodoAction('edit-open', { id });
  }
}

function handleCheckboxToggle(event) {
  const checkbox = event.target.closest('[data-action="toggle"]');
  if (!checkbox) return;
  const item = checkbox.closest('[data-id]');
  if (!item) return;
  eventBus.publish('INTENT_TODO_TOGGLE', { id: item.dataset.id, timestamp: Date.now() });
  logTodoAction('toggle', { id: item.dataset.id });
}

function handleViewToggle(activeButton, buttons) {
  buttons.forEach((button) => button.setAttribute('aria-pressed', button === activeButton ? 'true' : 'false'));
  const mode = activeButton.dataset.viewToggle;
  appRoot.dataset.view = mode;
  if (latestState) {
    renderList(latestState, mode);
  }
  logTodoAction('view-toggle', { mode });
}

function render(state) {
  latestState = state;
  const viewMode = appRoot?.dataset.view || 'list';
  if (appRoot) {
    appRoot.dataset.filter = state.filter;
    appRoot.dataset.total = String(state.stats.total);
    appRoot.dataset.completed = String(state.stats.completed);
  }
  renderList(state, viewMode);
  updateStats(state.stats);
  updateFilters(state.filter);
  renderLog(state.activity);
}

function renderList(state, viewMode = 'list') {
  if (!list || !template) return;
  const visible = getVisibleTodos(state.todos, state.filter);
  list.innerHTML = '';

  if (!visible.length) {
    list.innerHTML = '<li class="todo-empty">No todos for this filter. Add one above.</li>';
    return;
  }

  if (viewMode === 'board' && boardTemplate) {
    renderBoardList(visible);
    return;
  }

  visible.forEach((todo) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = todo.id;
    node.dataset.state = todo.completed ? 'completed' : 'active';
    node.dataset.priority = todo.priority || 'medium';
    node.querySelector('[data-action="toggle"]').checked = todo.completed;
    node.querySelector('.todo-item__title').textContent = todo.title;
    node.querySelector('.todo-item__meta').textContent = buildMeta(todo);
    list.appendChild(node);
  });
}

function renderBoardList(todos) {
  list.innerHTML = '';
  todos.forEach((todo) => {
    const node = boardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = todo.id;
    node.dataset.state = todo.completed ? 'completed' : 'active';
    node.dataset.priority = todo.priority || 'medium';
    node.querySelector('.todo-board-card__title').textContent = todo.title;
    node.querySelector('.todo-board-card__preview').textContent = buildPreview(todo.title);
    node.addEventListener('click', () => openEditDialog(todo.id));
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openEditDialog(todo.id);
      }
    });
    list.appendChild(node);
  });
}

function updateStats(stats = { total: 0, active: 0, completed: 0 }) {
  if (!statsNodes?.length) return;
  statsNodes.forEach((node) => {
    const key = node.dataset.stat;
    const value = stats[key] ?? 0;
    node.querySelector('strong').textContent = value;
  });
}

function updateFilters(activeFilter) {
  if (!filters) return;
  filters.querySelectorAll('[data-filter]').forEach((button) => {
    button.setAttribute('aria-selected', button.dataset.filter === activeFilter ? 'true' : 'false');
  });
}

function renderLog(entries = []) {
  if (!logList) return;
  logList.innerHTML = '';
  if (!entries.length) {
    logList.innerHTML = '<li class="todo-log-entry">No activity yet.</li>';
    return;
  }
  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'todo-log-entry';
    li.innerHTML = `<span>${entry.message}</span><span>${formatRelative(entry.timestamp)}</span>`;
    logList.appendChild(li);
  });
}

function getVisibleTodos(todos, filter) {
  if (filter === 'completed') return todos.filter((todo) => todo.completed);
  if (filter === 'active') return todos.filter((todo) => !todo.completed);
  return todos;
}

function buildMeta(todo) {
  const updated = formatRelative(todo.updatedAt);
  return `Updated ${updated}`;
}

function formatRelative(timestamp) {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function buildPreview(text = '') {
  const trimmed = `${text}`.trim();
  if (trimmed.length <= 80) return trimmed;
  return `${trimmed.slice(0, 80)}…`;
}

const unsubscribeTodoState = eventBus.subscribe('TODO_STATE_CHANGED', render);
const teardownTodoService = createTodoService(eventBus, { initialFilter: 'active', seedFallback: false });

window.addEventListener('beforeunload', () => {
  teardownTodoService?.();
  unsubscribeTodoState?.();
});

function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  setTheme(next, true);
  logTodoAction('theme-toggle', { theme: next });
}

function setTheme(theme, persist = false) {
  document.documentElement.dataset.theme = theme;
  const pressed = theme === 'dark' ? 'true' : 'false';
  themeToggle?.setAttribute('aria-pressed', pressed);
  if (themeLabel) {
    themeLabel.textContent = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
  if (persist) {
    storage.setItem(THEME_KEY, theme);
  }
}

function openEditDialog(id) {
  if (!editDialog || !dialogInput) return;
  const todo = getTodoById(id);
  if (!todo) return;
  editingTodoId = todo.id;
  dialogInput.value = todo.title;
  if (dialogToggle) {
    dialogToggle.checked = Boolean(todo.completed);
  }
  if (typeof editDialog.showModal === 'function') {
    editDialog.showModal();
  } else {
    editDialog.setAttribute('open', '');
  }
  dialogInput.focus();
}

function closeEditDialog() {
  if (!editDialog) return;
  editingTodoId = null;
  if (typeof editDialog.close === 'function') {
    editDialog.close();
  } else {
    editDialog.removeAttribute('open');
  }
  dialogForm?.reset();
}

function handleDialogSubmit(event) {
  event.preventDefault();
  if (!editingTodoId) {
    closeEditDialog();
    return;
  }
  const nextTitle = dialogInput?.value?.trim();
  if (!nextTitle) return;
  eventBus.publish('INTENT_TODO_UPDATE', { id: editingTodoId, title: nextTitle, timestamp: Date.now() });
  logTodoAction('edit-save', { id: editingTodoId });
  closeEditDialog();
}

function handleDialogToggle(event) {
  if (!editingTodoId) return;
  if (!event.target) return;
  eventBus.publish('INTENT_TODO_TOGGLE', { id: editingTodoId, timestamp: Date.now() });
  logTodoAction('dialog-toggle', { id: editingTodoId });
}

function handleDialogDelete() {
  if (!editingTodoId) return;
  eventBus.publish('INTENT_TODO_DELETE', { id: editingTodoId, timestamp: Date.now() });
  logTodoAction('dialog-delete', { id: editingTodoId });
  closeEditDialog();
}

function logTodoAction(action, extra = {}) {
  // Internal developer log (localStorage)
  logAccumulator.log('todo-action', {
    component: 'todo-app',
    action,
    ...extra
  });

  // Analytics track (Backend)
  logAccumulator.track('Todo Interaction', {
    action,
    component: 'todo-app',
    ...extra
  });
}

function getTodoById(id) {
  if (!latestState) return null;
  return latestState.todos.find((todo) => todo.id === id);
}

function createStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn('[TodoApp] localStorage unavailable', error);
  }
  return {
    getItem() {
      return null;
    },
    setItem() { },
    removeItem() { }
  };
}
