import EventBus from '../../library/runtime/EventBus.js';
import { Contracts as BaseContracts, contract } from '../../library/runtime/Contracts.js';
import { LogAccumulator } from '../../library/runtime/LogAccumulator.js';
import { object, string, number, boolean, enums, optional, size, array } from '../../library/runtime/validation/index.js';
import { createTodoService } from './services/TodoService.js';

const FILTERS = ['all', 'active', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];

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

// Local LogAccumulator for dev logging (no server endpoint)
const logAccumulator = window.csma?.logAccumulator || new LogAccumulator(eventBus);

const appRoot = document.querySelector('[data-todo-app]');
const form = appRoot?.querySelector('[data-todo-form]');
const list = appRoot?.querySelector('[data-todo-list]');
const filters = appRoot?.querySelector('.todo-filters');
const statsNodes = appRoot?.querySelectorAll('[data-stat]');
const logList = appRoot?.querySelector('[data-todo-log]');
const template = document.getElementById('todo-item-template');
const boardTemplate = document.getElementById('todo-board-template');
const themeToggle = document.querySelector('[data-theme-toggle]');
const editDialog = document.querySelector('[data-edit-dialog]');
const dialogForm = editDialog?.querySelector('[data-dialog-form]');
const dialogInput = editDialog?.querySelector('[data-dialog-input]');
const dialogClose = editDialog?.querySelector('[data-dialog-close]');
const dialogCancel = editDialog?.querySelector('[data-dialog-cancel]');
const dialogToggle = editDialog?.querySelector('[data-dialog-toggle]');
const dialogDelete = editDialog?.querySelector('[data-dialog-delete]');
const submitButton = form?.querySelector('[type="submit"]');

let editingTodoId = null;
let latestState = null;
let lastDialogTrigger = null;

themeToggle?.addEventListener('click', handleThemeToggle);

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
  form.addEventListener('input', syncCreateButtonState);
  filters.addEventListener('click', handleFilterClick);
  list.addEventListener('click', handleListAction);
  list.addEventListener('change', handleCheckboxToggle);

  const viewToggles = appRoot.querySelectorAll('[data-view-toggle]');
  const togglesContainer = appRoot.querySelector('.todo-toggles');
  // Set initial active state for animated indicator
  if (togglesContainer) {
    togglesContainer.dataset.active = appRoot.dataset.view || 'list';
  }
  viewToggles.forEach((btn) => btn.addEventListener('click', () => handleViewToggle(btn, viewToggles)));
  syncCreateButtonState();
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
  syncCreateButtonState();
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
    lastDialogTrigger = button;
    openEditDialog(id);
    logTodoAction('edit-open', { id });
  } else if (button.dataset.action === 'open') {
    lastDialogTrigger = button;
    openEditDialog(id);
    logTodoAction('board-open', { id });
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
  // Update animated indicator position
  const togglesContainer = appRoot.querySelector('.todo-toggles');
  if (togglesContainer) {
    togglesContainer.dataset.active = mode;
  }
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

  if (!visible.length) {
    renderEmptyListState(getEmptyStateMessage(state.filter));
    return;
  }

  syncTodoList(visible, viewMode);
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
    button.setAttribute('aria-pressed', button.dataset.filter === activeFilter ? 'true' : 'false');
  });
}

function renderLog(entries = []) {
  if (!logList) return;
  if (!entries.length) {
    const emptyNode = document.createElement('li');
    emptyNode.className = 'todo-log-entry todo-log-entry--empty';
    emptyNode.textContent = 'No activity yet. Create or complete a task to see changes here.';
    logList.replaceChildren(emptyNode);
    return;
  }

  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'todo-log-entry';
    const message = document.createElement('span');
    message.textContent = entry.message;
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = formatRelative(entry.timestamp);
    li.append(message, time);
    fragment.appendChild(li);
  });
  logList.replaceChildren(fragment);
}

function syncTodoList(todos, viewMode) {
  if (!list || !template) return;
  const existingNodes = new Map(
    Array.from(list.querySelectorAll('[data-id]')).map((node) => [node.dataset.id, node])
  );
  const fragment = document.createDocumentFragment();

  todos.forEach((todo) => {
    const currentNode = existingNodes.get(todo.id);
    const canReuse = currentNode && currentNode.dataset.viewMode === viewMode;
    const node = canReuse ? currentNode : createTodoNode(todo, viewMode);

    updateTodoNode(node, todo, viewMode);
    fragment.appendChild(node);
    existingNodes.delete(todo.id);
  });

  list.replaceChildren(fragment);
}

function createTodoNode(todo, viewMode) {
  const source = viewMode === 'board' ? boardTemplate : template;
  const node = source?.content.firstElementChild.cloneNode(true);
  if (!node) {
    throw new Error(`Missing todo template for view: ${viewMode}`);
  }
  node.dataset.id = todo.id;
  node.dataset.viewMode = viewMode;
  return node;
}

function updateTodoNode(node, todo, viewMode) {
  node.dataset.id = todo.id;
  node.dataset.viewMode = viewMode;
  node.dataset.state = todo.completed ? 'completed' : 'active';
  node.dataset.priority = todo.priority || 'medium';

  if (viewMode === 'board') {
    node.querySelector('.todo-board-card__button').setAttribute('aria-label', `Open details for ${todo.title}`);
    node.querySelector('.todo-board-card__title').textContent = todo.title;
    node.querySelector('.todo-board-card__preview').textContent = buildPreview(todo.title);
    return;
  }

  node.querySelector('[data-action="toggle"]').checked = todo.completed;
  node.querySelector('.todo-item__title').textContent = todo.title;
  node.querySelector('.todo-item__title').title = todo.title;
  node.querySelector('.todo-item__meta').textContent = buildMeta(todo);
}

function renderEmptyListState(message) {
  if (!list) return;
  const emptyNode = document.createElement('li');
  emptyNode.className = 'todo-empty';

  // Use inline SVG for consistent rendering across platforms
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'todo-empty__icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.5');
  icon.setAttribute('aria-hidden', 'true');

  const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
  clipPath.setAttribute('id', 'a');

  const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  clipRect.setAttribute('d', 'M0 0h24v24H0z');
  clipPath.appendChild(clipRect);
  icon.appendChild(clipPath);

  const paths = [
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
    'M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    'M9 12h6',
    'M9 16h6'
  ];

  paths.forEach((d) => {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    icon.appendChild(path);
  });

  const text = document.createElement('p');
  text.textContent = message;

  emptyNode.appendChild(icon);
  emptyNode.appendChild(text);
  list.replaceChildren(emptyNode);
}

function getVisibleTodos(todos, filter) {
  if (filter === 'completed') return todos.filter((todo) => todo.completed);
  if (filter === 'active') return todos.filter((todo) => !todo.completed);
  return todos;
}

function buildMeta(todo) {
  const updated = formatRelative(todo.updatedAt);
  const status = todo.completed ? 'Done' : 'Open';
  return `${status} · Updated ${updated}`;
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

function getEmptyStateMessage(filter) {
  if (filter === 'completed') {
    return 'No completed tasks yet. Finish one to build history.';
  }
  if (filter === 'active') {
    return 'No open tasks right now. Everything is done.';
  }
  return 'No tasks yet. Add the first task above.';
}

const unsubscribeTodoState = eventBus.subscribe('TODO_STATE_CHANGED', render);
const teardownTodoService = createTodoService(eventBus, { initialFilter: 'active', seedFallback: false });

window.addEventListener('beforeunload', () => {
  teardownTodoService?.();
  unsubscribeTodoState?.();
});

function handleThemeToggle() {
  logTodoAction('theme-toggle', { theme: document.documentElement.dataset.theme || 'light' });
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
  dialogInput.focus({ preventScroll: true });
  dialogInput.setSelectionRange(0, dialogInput.value.length);
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
  lastDialogTrigger?.focus?.();
  lastDialogTrigger = null;
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

  // Phase 1 moved analytics out of LogAccumulator.
  window.csma?.analytics?.track('Todo Interaction', {
    action,
    component: 'todo-app',
    ...extra
  });
}

function getTodoById(id) {
  if (!latestState) return null;
  return latestState.todos.find((todo) => todo.id === id);
}

function syncCreateButtonState() {
  if (!form || !submitButton) return;
  const titleInput = form.elements.namedItem('title');
  const nextValue = typeof titleInput?.value === 'string' ? titleInput.value.trim() : '';
  submitButton.disabled = !nextValue;
}
