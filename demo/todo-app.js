/**
 * Todo App DOM layer.
 * Receives a CSMA EventBus instance. Subscribes to state changes,
 * publishes user intents.
 */

export function initTodoApp(eventBus) {
  const appRoot = document.querySelector('[data-todo-app]');
  if (!appRoot) return;

  const form = appRoot.querySelector('[data-todo-form]');
  const list = appRoot.querySelector('[data-todo-list]');
  const filters = appRoot.querySelector('.todo-filters');
  const statsNodes = appRoot.querySelectorAll('[data-stat]');
  const logList = appRoot.querySelector('[data-todo-log]');
  const template = document.getElementById('todo-item-template');
  const boardTemplate = document.getElementById('todo-board-template');
  const editDialog = document.querySelector('[data-edit-dialog]');
  const dialogForm = editDialog?.querySelector('[data-dialog-form]');
  const dialogInput = editDialog?.querySelector('[data-dialog-input]');
  const dialogClose = editDialog?.querySelector('[data-dialog-close]');
  const dialogCancel = editDialog?.querySelector('[data-dialog-cancel]');
  const dialogToggle = editDialog?.querySelector('[data-dialog-toggle]');
  const dialogDelete = editDialog?.querySelector('[data-dialog-delete]');
  const submitButton = form?.querySelector('[type="submit"]');

  let editingTodoId = null;
  let lastDialogTrigger = null;
  let latestState = null;

  /* Subscribe to state changes from the service */
  const unsubscribe = eventBus.subscribe('TODO_STATE_CHANGED', render);

  /* Event handlers */
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = sanitize(new FormData(form).get('title'));
      if (!title) { syncCreateButton(); return; }
      eventBus.publish('INTENT_TODO_CREATE', { title, timestamp: Date.now() });
      form.reset();
      syncCreateButton();
    });
    form.addEventListener('input', syncCreateButton);
  }

  if (filters) {
    filters.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.action === 'clear-completed') {
        eventBus.publish('INTENT_TODO_CLEAR_COMPLETED', { timestamp: Date.now() });
        return;
      }
      const filter = btn.dataset.filter;
      if (filter) eventBus.publish('INTENT_TODO_FILTER', { filter, timestamp: Date.now() });
    });
  }

  if (list) {
    list.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const item = btn.closest('[data-id]');
      if (!item) return;
      const id = item.dataset.id;
      if (btn.dataset.action === 'delete') {
        eventBus.publish('INTENT_TODO_DELETE', { id, timestamp: Date.now() });
        return;
      }
      if (btn.dataset.action === 'edit' || btn.dataset.action === 'open') {
        lastDialogTrigger = btn;
        openEditDialog(id);
      }
    });
    list.addEventListener('change', (e) => {
      const cb = e.target.closest('[data-action="toggle"]');
      if (!cb) return;
      const item = cb.closest('[data-id]');
      if (item) eventBus.publish('INTENT_TODO_TOGGLE', { id: item.dataset.id, timestamp: Date.now() });
    });
  }

  if (dialogForm) {
    dialogForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!editingTodoId || !dialogInput) { closeEditDialog(); return; }
      const title = sanitize(dialogInput.value);
      if (!title) { dialogInput.focus(); return; }
      eventBus.publish('INTENT_TODO_UPDATE', { id: editingTodoId, title, timestamp: Date.now() });
      closeEditDialog();
    });
  }

  dialogClose?.addEventListener('click', closeEditDialog);
  dialogCancel?.addEventListener('click', closeEditDialog);
  dialogToggle?.addEventListener('change', () => {
    if (editingTodoId) eventBus.publish('INTENT_TODO_TOGGLE', { id: editingTodoId, timestamp: Date.now() });
  });
  dialogDelete?.addEventListener('click', () => {
    if (editingTodoId) {
      eventBus.publish('INTENT_TODO_DELETE', { id: editingTodoId, timestamp: Date.now() });
      closeEditDialog();
    }
  });
  editDialog?.addEventListener('cancel', (e) => { e.preventDefault(); closeEditDialog(); });

  /* View toggles */
  const viewToggles = appRoot.querySelectorAll('[data-view-toggle]');
  viewToggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      viewToggles.forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      const mode = btn.dataset.viewToggle;
      appRoot.dataset.view = mode;
      const toggles = appRoot.querySelector('.todo-toggles');
      if (toggles) toggles.dataset.active = mode;
      if (latestState) renderList(latestState, mode);
    });
  });

  syncCreateButton();

  /* Render functions */
  function render(state) {
    latestState = state;
    const viewMode = appRoot.dataset.view || 'list';
    appRoot.dataset.filter = state.filter;
    appRoot.dataset.total = String(state.stats.total);
    appRoot.dataset.completed = String(state.stats.completed);
    renderList(state, viewMode);
    updateStats(state.stats);
    updateFilters(state.filter);
    renderLog(state.activity);
  }

  function renderList(state, viewMode) {
    const visible = getVisible(state.todos, state.filter);
    if (!visible.length) {
      renderEmpty(getEmptyMessage(state.filter));
      return;
    }
    syncTodoList(visible, viewMode);
  }

  function syncTodoList(todos, viewMode) {
    if (!list || !template || !boardTemplate) return;
    const existing = new Map();
    list.querySelectorAll('[data-id]').forEach((n) => existing.set(n.dataset.id, n));
    const fragment = document.createDocumentFragment();

    todos.forEach((todo) => {
      const current = existing.get(todo.id);
      const canReuse = current && current.dataset.viewMode === viewMode;
      const node = canReuse ? current : createNode(todo, viewMode);
      updateNode(node, todo, viewMode);
      fragment.appendChild(node);
      existing.delete(todo.id);
    });

    list.replaceChildren(fragment);
  }

  function createNode(todo, viewMode) {
    const src = viewMode === 'board' ? boardTemplate : template;
    const node = src.content.firstElementChild.cloneNode(true);
    node.dataset.id = todo.id;
    node.dataset.viewMode = viewMode;
    return node;
  }

  function updateNode(node, todo, viewMode) {
    node.dataset.id = todo.id;
    node.dataset.viewMode = viewMode;
    node.dataset.state = todo.completed ? 'completed' : 'active';
    node.dataset.priority = todo.priority || 'medium';

    if (viewMode === 'board') {
      const title = node.querySelector('.todo-board-card__title');
      const preview = node.querySelector('.todo-board-card__preview');
      const btn = node.querySelector('.todo-board-card__button');
      if (title) title.textContent = todo.title;
      if (preview) preview.textContent = previewText(todo.title);
      if (btn) btn.setAttribute('aria-label', `Open details for ${todo.title}`);
      return;
    }

    const cb = node.querySelector('[data-action="toggle"]');
    const titleNode = node.querySelector('.todo-item__title');
    const metaNode = node.querySelector('.todo-item__meta');
    if (cb) cb.checked = Boolean(todo.completed);
    if (titleNode) { titleNode.textContent = todo.title; titleNode.title = todo.title; }
    if (metaNode) metaNode.textContent = buildMeta(todo);
  }

  function renderEmpty(message) {
    if (!list) return;
    const node = document.createElement('li');
    node.className = 'todo-empty';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'todo-empty__icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('aria-hidden', 'true');
    [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
      'M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'M9 12h6',
      'M9 16h6'
    ].forEach((d) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });

    const p = document.createElement('p');
    p.textContent = message;
    node.appendChild(svg);
    node.appendChild(p);
    list.replaceChildren(node);
  }

  function updateStats(stats) {
    statsNodes.forEach((node) => {
      const key = node.dataset.stat;
      const value = stats[key] ?? 0;
      const valueNode = node.querySelector('strong');
      if (valueNode) valueNode.textContent = key === 'completionRate' ? `${value}%` : String(value);
    });
  }

  function updateFilters(active) {
    if (!filters) return;
    filters.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.filter === active ? 'true' : 'false');
    });
  }

  function renderLog(entries) {
    if (!logList) return;
    if (!entries?.length) {
      const li = document.createElement('li');
      li.className = 'todo-log-entry todo-log-entry--empty';
      li.textContent = 'No activity yet. Create or complete a task to see changes here.';
      logList.replaceChildren(li);
      return;
    }
    const fragment = document.createDocumentFragment();
    entries.forEach((e) => {
      const li = document.createElement('li');
      li.className = 'todo-log-entry';
      const msg = document.createElement('span');
      msg.textContent = e.message;
      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = relativeTime(e.timestamp);
      li.appendChild(msg);
      li.appendChild(time);
      fragment.appendChild(li);
    });
    logList.replaceChildren(fragment);
  }

  /* Dialog */
  function openEditDialog(id) {
    if (!editDialog || !dialogInput) return;
    const todo = latestState?.todos?.find((t) => t.id === id);
    if (!todo) return;
    editingTodoId = todo.id;
    dialogInput.value = todo.title;
    if (dialogToggle) dialogToggle.checked = Boolean(todo.completed);
    if (typeof editDialog.showModal === 'function') editDialog.showModal();
    else editDialog.setAttribute('open', '');
    dialogInput.focus({ preventScroll: true });
    dialogInput.setSelectionRange(0, dialogInput.value.length);
  }

  function closeEditDialog() {
    if (!editDialog) return;
    editingTodoId = null;
    if (typeof editDialog.close === 'function') editDialog.close();
    else editDialog.removeAttribute('open');
    if (dialogForm) dialogForm.reset();
    if (lastDialogTrigger) { lastDialogTrigger.focus(); lastDialogTrigger = null; }
  }

  function syncCreateButton() {
    if (!form || !submitButton) return;
    const input = form.elements.namedItem('title');
    const val = input?.value?.trim() ?? '';
    submitButton.disabled = val.length === 0;
  }

  /* Utilities */
  function getVisible(todos, filter) {
    if (filter === 'completed') return todos.filter((t) => t.completed);
    if (filter === 'active') return todos.filter((t) => !t.completed);
    return todos;
  }

  function getEmptyMessage(filter) {
    if (filter === 'completed') return 'No completed tasks yet. Finish one to build history.';
    if (filter === 'active') return 'No open tasks right now. Everything is done.';
    return 'No tasks yet. Add the first task above.';
  }

  function buildMeta(todo) {
    return `${todo.completed ? 'Done' : 'Open'} · Updated ${relativeTime(todo.updatedAt)}`;
  }

  function previewText(text) {
    const t = String(text || '').trim();
    return t.length <= 80 ? t : t.slice(0, 80) + '…';
  }

  function relativeTime(ts) {
    if (!ts) return '—';
    const diff = Date.now() - ts;
    const m = Math.round(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h / 24)}d ago`;
  }

  function sanitize(text) {
    return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  }

  return unsubscribe;
}
