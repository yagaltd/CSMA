(function () {
  const FILTERS = ['all', 'active', 'completed'];
  const STORAGE_KEY = 'csma.todo-app';
  const LEGACY_KEYS = ['todo-items', 'todos', 'todo-app', 'todo-app:v2'];
  const FALLBACK_SEED = [
    { title: 'Draft copy for marketing site', completed: false, priority: 'medium' },
    { title: 'Wireframe dashboard empty states', completed: true, priority: 'low' },
    { title: 'Prepare accessibility checklist', completed: false, priority: 'high' }
  ];

  class EventBus {
    constructor() {
      this.handlers = new Map();
    }

    subscribe(eventName, handler) {
      if (!this.handlers.has(eventName)) {
        this.handlers.set(eventName, new Set());
      }

      const bucket = this.handlers.get(eventName);
      bucket.add(handler);

      return () => {
        bucket.delete(handler);
        if (bucket.size === 0) {
          this.handlers.delete(eventName);
        }
      };
    }

    publish(eventName, payload) {
      const bucket = this.handlers.get(eventName);
      if (!bucket) {
        return;
      }

      bucket.forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error('[todo-app] Event handler failed for ' + eventName, error);
        }
      });
    }
  }

  const appRoot = document.querySelector('[data-todo-app]');
  if (!appRoot) {
    return;
  }

  const form = appRoot.querySelector('[data-todo-form]');
  const list = appRoot.querySelector('[data-todo-list]');
  const filters = appRoot.querySelector('.todo-filters');
  const statsNodes = appRoot.querySelectorAll('[data-stat]');
  const logList = appRoot.querySelector('[data-todo-log]');
  const template = document.getElementById('todo-item-template');
  const boardTemplate = document.getElementById('todo-board-template');
  const editDialog = document.querySelector('[data-edit-dialog]');
  const dialogForm = editDialog ? editDialog.querySelector('[data-dialog-form]') : null;
  const dialogInput = editDialog ? editDialog.querySelector('[data-dialog-input]') : null;
  const dialogClose = editDialog ? editDialog.querySelector('[data-dialog-close]') : null;
  const dialogCancel = editDialog ? editDialog.querySelector('[data-dialog-cancel]') : null;
  const dialogToggle = editDialog ? editDialog.querySelector('[data-dialog-toggle]') : null;
  const dialogDelete = editDialog ? editDialog.querySelector('[data-dialog-delete]') : null;
  const submitButton = form ? form.querySelector('[type="submit"]') : null;

  const eventBus = new EventBus();
  const logAccumulator = createLocalLogAccumulator();

  let editingTodoId = null;
  let latestState = null;
  let lastDialogTrigger = null;

  const unsubscribeTodoState = eventBus.subscribe('TODO_STATE_CHANGED', render);
  const teardownTodoService = createTodoService(eventBus, {
    storageKey: STORAGE_KEY,
    legacyKeys: LEGACY_KEYS,
    initialFilter: 'all',
    seedFallback: true
  });

  appRoot.dataset.view = appRoot.dataset.view || 'list';

  if (form) {
    form.addEventListener('submit', handleSubmit);
    form.addEventListener('input', syncCreateButtonState);
  }

  if (filters) {
    filters.addEventListener('click', handleFilterClick);
  }

  if (list) {
    list.addEventListener('click', handleListAction);
    list.addEventListener('change', handleCheckboxToggle);
  }

  if (dialogForm) {
    dialogForm.addEventListener('submit', handleDialogSubmit);
  }

  if (dialogClose) {
    dialogClose.addEventListener('click', function () {
      closeEditDialog();
    });
  }

  if (dialogCancel) {
    dialogCancel.addEventListener('click', function () {
      closeEditDialog();
    });
  }

  if (dialogToggle) {
    dialogToggle.addEventListener('change', handleDialogToggle);
  }

  if (dialogDelete) {
    dialogDelete.addEventListener('click', handleDialogDelete);
  }

  if (editDialog) {
    editDialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeEditDialog();
    });
  }

  const viewToggles = appRoot.querySelectorAll('[data-view-toggle]');
  const togglesContainer = appRoot.querySelector('.todo-toggles');
  if (togglesContainer) {
    togglesContainer.dataset.active = appRoot.dataset.view || 'list';
  }
  viewToggles.forEach((button) => {
    button.addEventListener('click', function () {
      handleViewToggle(button, viewToggles);
    });
  });

  syncCreateButtonState();

  window.addEventListener('beforeunload', function () {
    teardownTodoService();
    unsubscribeTodoState();
  });

  function handleSubmit(event) {
    event.preventDefault();
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const title = sanitize(formData.get('title'));
    if (!title) {
      syncCreateButtonState();
      return;
    }

    eventBus.publish('INTENT_TODO_CREATE', {
      title: title,
      timestamp: Date.now()
    });
    logTodoAction('create', { title: title });
    form.reset();
    syncCreateButtonState();
  }

  function handleFilterClick(event) {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }

    if (button.dataset.action === 'clear-completed') {
      eventBus.publish('INTENT_TODO_CLEAR_COMPLETED', { timestamp: Date.now() });
      logTodoAction('clear-completed');
      return;
    }

    const filter = button.dataset.filter;
    if (!FILTERS.includes(filter)) {
      return;
    }

    eventBus.publish('INTENT_TODO_FILTER', {
      filter: filter,
      timestamp: Date.now()
    });
    logTodoAction('filter-change', { filter: filter });
  }

  function handleListAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const item = button.closest('[data-id]');
    if (!item) {
      return;
    }

    const id = item.dataset.id;
    if (button.dataset.action === 'delete') {
      eventBus.publish('INTENT_TODO_DELETE', { id: id, timestamp: Date.now() });
      logTodoAction('delete', { id: id });
      return;
    }

    if (button.dataset.action === 'edit' || button.dataset.action === 'open') {
      lastDialogTrigger = button;
      openEditDialog(id);
      logTodoAction(button.dataset.action === 'edit' ? 'edit-open' : 'board-open', { id: id });
    }
  }

  function handleCheckboxToggle(event) {
    const checkbox = event.target.closest('[data-action="toggle"]');
    if (!checkbox) {
      return;
    }

    const item = checkbox.closest('[data-id]');
    if (!item) {
      return;
    }

    eventBus.publish('INTENT_TODO_TOGGLE', {
      id: item.dataset.id,
      timestamp: Date.now()
    });
    logTodoAction('toggle', { id: item.dataset.id });
  }

  function handleViewToggle(activeButton, buttons) {
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', button === activeButton ? 'true' : 'false');
    });

    const mode = activeButton.dataset.viewToggle;
    appRoot.dataset.view = mode;

    const toggles = appRoot.querySelector('.todo-toggles');
    if (toggles) {
      toggles.dataset.active = mode;
    }

    if (latestState) {
      renderList(latestState, mode);
    }

    logTodoAction('view-toggle', { mode: mode });
  }

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
    const visible = getVisibleTodos(state.todos, state.filter);

    if (!visible.length) {
      renderEmptyListState(getEmptyStateMessage(state.filter));
      return;
    }

    syncTodoList(visible, viewMode);
  }

  function updateStats(stats) {
    statsNodes.forEach((node) => {
      const key = node.dataset.stat;
      const value = stats[key] || 0;
      const valueNode = node.querySelector('strong');
      if (valueNode) {
        valueNode.textContent = String(value);
      }
    });
  }

  function updateFilters(activeFilter) {
    if (!filters) {
      return;
    }

    filters.querySelectorAll('[data-filter]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.filter === activeFilter ? 'true' : 'false');
    });
  }

  function renderLog(entries) {
    if (!logList) {
      return;
    }

    if (!entries || !entries.length) {
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

      li.appendChild(message);
      li.appendChild(time);
      fragment.appendChild(li);
    });

    logList.replaceChildren(fragment);
  }

  function syncTodoList(todos, viewMode) {
    if (!list || !template || !boardTemplate) {
      return;
    }

    const existingNodes = new Map();
    list.querySelectorAll('[data-id]').forEach((node) => {
      existingNodes.set(node.dataset.id, node);
    });

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
    const node = source && source.content && source.content.firstElementChild
      ? source.content.firstElementChild.cloneNode(true)
      : null;

    if (!node) {
      throw new Error('Missing todo template for view: ' + viewMode);
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
      const openButton = node.querySelector('.todo-board-card__button');
      const title = node.querySelector('.todo-board-card__title');
      const preview = node.querySelector('.todo-board-card__preview');

      if (openButton) {
        openButton.setAttribute('aria-label', 'Open details for ' + todo.title);
      }
      if (title) {
        title.textContent = todo.title;
      }
      if (preview) {
        preview.textContent = buildPreview(todo.title);
      }
      return;
    }

    const checkbox = node.querySelector('[data-action="toggle"]');
    const titleNode = node.querySelector('.todo-item__title');
    const metaNode = node.querySelector('.todo-item__meta');

    if (checkbox) {
      checkbox.checked = Boolean(todo.completed);
    }
    if (titleNode) {
      titleNode.textContent = todo.title;
      titleNode.title = todo.title;
    }
    if (metaNode) {
      metaNode.textContent = buildMeta(todo);
    }
  }

  function renderEmptyListState(message) {
    if (!list) {
      return;
    }

    const emptyNode = document.createElement('li');
    emptyNode.className = 'todo-empty';

    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'todo-empty__icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.5');
    icon.setAttribute('aria-hidden', 'true');

    [
      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2',
      'M9 5a2 2 0 012-2h2a2 2 0 012 2v0a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      'M9 12h6',
      'M9 16h6'
    ].forEach((definition) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', definition);
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
    if (filter === 'completed') {
      return todos.filter((todo) => todo.completed);
    }
    if (filter === 'active') {
      return todos.filter((todo) => !todo.completed);
    }
    return todos;
  }

  function buildMeta(todo) {
    const updated = formatRelative(todo.updatedAt);
    const status = todo.completed ? 'Done' : 'Open';
    return status + ' · Updated ' + updated;
  }

  function formatRelative(timestamp) {
    if (!timestamp) {
      return '—';
    }

    const diff = Date.now() - timestamp;
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) {
      return 'just now';
    }
    if (minutes < 60) {
      return minutes + 'm ago';
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return hours + 'h ago';
    }

    const days = Math.round(hours / 24);
    return days + 'd ago';
  }

  function buildPreview(text) {
    const trimmed = String(text || '').trim();
    if (trimmed.length <= 80) {
      return trimmed;
    }
    return trimmed.slice(0, 80) + '…';
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

  function openEditDialog(id) {
    if (!editDialog || !dialogInput) {
      return;
    }

    const todo = getTodoById(id);
    if (!todo) {
      return;
    }

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
    if (!editDialog) {
      return;
    }

    editingTodoId = null;
    if (typeof editDialog.close === 'function') {
      editDialog.close();
    } else {
      editDialog.removeAttribute('open');
    }

    if (dialogForm) {
      dialogForm.reset();
    }

    if (lastDialogTrigger && typeof lastDialogTrigger.focus === 'function') {
      lastDialogTrigger.focus();
    }
    lastDialogTrigger = null;
  }

  function handleDialogSubmit(event) {
    event.preventDefault();
    if (!editingTodoId || !dialogInput) {
      closeEditDialog();
      return;
    }

    const nextTitle = sanitize(dialogInput.value);
    if (!nextTitle) {
      dialogInput.focus();
      return;
    }

    eventBus.publish('INTENT_TODO_UPDATE', {
      id: editingTodoId,
      title: nextTitle,
      timestamp: Date.now()
    });
    logTodoAction('edit-save', { id: editingTodoId });
    closeEditDialog();
  }

  function handleDialogToggle() {
    if (!editingTodoId) {
      return;
    }

    eventBus.publish('INTENT_TODO_TOGGLE', {
      id: editingTodoId,
      timestamp: Date.now()
    });
    logTodoAction('dialog-toggle', { id: editingTodoId });
  }

  function handleDialogDelete() {
    if (!editingTodoId) {
      return;
    }

    eventBus.publish('INTENT_TODO_DELETE', {
      id: editingTodoId,
      timestamp: Date.now()
    });
    logTodoAction('dialog-delete', { id: editingTodoId });
    closeEditDialog();
  }

  function logTodoAction(action, extra) {
    const payload = Object.assign({
      component: 'todo-app',
      action: action
    }, extra || {});

    logAccumulator.log('todo-action', payload);
    if (window.csma && window.csma.analytics && typeof window.csma.analytics.track === 'function') {
      window.csma.analytics.track('Todo Interaction', payload);
    }
  }

  function getTodoById(id) {
    if (!latestState || !Array.isArray(latestState.todos)) {
      return null;
    }

    return latestState.todos.find((todo) => todo.id === id) || null;
  }

  function syncCreateButtonState() {
    if (!form || !submitButton) {
      return;
    }

    const titleInput = form.elements.namedItem('title');
    const nextValue = titleInput && typeof titleInput.value === 'string'
      ? titleInput.value.trim()
      : '';
    submitButton.disabled = nextValue.length === 0;
  }

  function createTodoService(bus, options) {
    const storageKey = options.storageKey || STORAGE_KEY;
    const legacyKeys = Array.isArray(options.legacyKeys) ? options.legacyKeys : [];
    const seedFallback = options.seedFallback !== false;
    let filter = FILTERS.includes(options.initialFilter) ? options.initialFilter : 'all';
    let todos = loadInitialTodos(storageKey, legacyKeys, seedFallback);
    let activity = [];

    const subscriptions = [
      bus.subscribe('INTENT_TODO_CREATE', handleCreate),
      bus.subscribe('INTENT_TODO_TOGGLE', handleToggle),
      bus.subscribe('INTENT_TODO_DELETE', handleDelete),
      bus.subscribe('INTENT_TODO_UPDATE', handleUpdate),
      bus.subscribe('INTENT_TODO_CLEAR_COMPLETED', handleClearCompleted),
      bus.subscribe('INTENT_TODO_FILTER', handleFilterChange)
    ];

    emitChange('init');

    return function teardown() {
      subscriptions.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };

    function handleCreate(payload) {
      const title = sanitize(payload && payload.title);
      if (!title) {
        return;
      }

      const now = Date.now();
      const newTodo = {
        id: payload && payload.id ? payload.id : uniqueId(now),
        title: title,
        completed: Boolean(payload && payload.completed),
        createdAt: now,
        updatedAt: now,
        priority: payload && payload.priority ? payload.priority : 'medium'
      };

      todos = [newTodo].concat(todos);
      persist();
      track(title + ' added');
      emitChange('created');
    }

    function handleToggle(payload) {
      if (!payload || !payload.id) {
        return;
      }

      let changedTitle = null;
      let nextCompleted = false;
      todos = todos.map((todo) => {
        if (todo.id !== payload.id) {
          return todo;
        }

        changedTitle = todo.title;
        nextCompleted = !todo.completed;
        return Object.assign({}, todo, {
          completed: nextCompleted,
          updatedAt: Date.now()
        });
      });

      if (!changedTitle) {
        return;
      }

      persist();
      track(changedTitle + ' marked ' + (nextCompleted ? 'done' : 'active'));
      emitChange('toggled');
    }

    function handleDelete(payload) {
      if (!payload || !payload.id) {
        return;
      }

      const target = todos.find((todo) => todo.id === payload.id);
      if (!target) {
        return;
      }

      todos = todos.filter((todo) => todo.id !== payload.id);
      persist();
      track(target.title + ' removed');
      emitChange('deleted');
    }

    function handleUpdate(payload) {
      if (!payload || !payload.id) {
        return;
      }

      const nextTitle = sanitize(payload.title);
      if (!nextTitle) {
        return;
      }

      let didUpdate = false;
      todos = todos.map((todo) => {
        if (todo.id !== payload.id) {
          return todo;
        }

        didUpdate = true;
        return Object.assign({}, todo, {
          title: nextTitle,
          updatedAt: Date.now()
        });
      });

      if (!didUpdate) {
        return;
      }

      persist();
      track(nextTitle + ' updated');
      emitChange('updated');
    }

    function handleClearCompleted() {
      const removed = todos.filter((todo) => todo.completed).length;
      if (!removed) {
        return;
      }

      todos = todos.filter((todo) => !todo.completed);
      persist();
      track(String(removed) + ' completed tasks cleared');
      emitChange('clear-completed');
    }

    function handleFilterChange(payload) {
      if (!payload || !FILTERS.includes(payload.filter)) {
        return;
      }

      filter = payload.filter;
      emitChange('filter-changed');
    }

    function emitChange(reason) {
      const stats = buildStats(todos);
      bus.publish('TODO_STATE_CHANGED', {
        todos: todos.slice(),
        filter: filter,
        reason: reason,
        stats: stats,
        insights: buildInsights(todos, stats),
        activity: activity.slice(),
        timestamp: Date.now()
      });
    }

    function persist() {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(todos));
      } catch (error) {
        console.warn('[todo-app] Unable to persist todos', error);
      }
    }

    function track(message) {
      activity = [{ message: message, timestamp: Date.now() }].concat(activity).slice(0, 6);

      if (window.csma && window.csma.analytics && typeof window.csma.analytics.track === 'function') {
        window.csma.analytics.track('Todo Action', {
          message: message,
          action: 'todo-crud'
        });
      }
    }

    function buildStats(source) {
      const total = source.length;
      const completed = source.filter((todo) => todo.completed).length;
      const active = total - completed;
      const completionRate = total ? Math.round((completed / total) * 100) : 0;
      return {
        total: total,
        completed: completed,
        active: active,
        completionRate: completionRate
      };
    }

    function buildInsights(source, stats) {
      const focus = source.find((todo) => !todo.completed);
      const lastUpdated = source.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
      return {
        completionRate: stats.completionRate,
        focusTask: focus ? focus.title : 'All caught up',
        lastUpdated: lastUpdated ? lastUpdated.updatedAt : null
      };
    }

    function loadInitialTodos(primaryKey, extraKeys, seed) {
      const keys = [primaryKey].concat(extraKeys);
      for (let index = 0; index < keys.length; index += 1) {
        const candidate = readTodos(keys[index]);
        if (candidate) {
          return candidate;
        }
      }
      return seed ? normalize(FALLBACK_SEED) : [];
    }

    function readTodos(key) {
      if (!key) {
        return null;
      }

      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return normalize(parsed);
        }
      } catch (error) {
        console.warn('[todo-app] Failed to parse stored todos for key ' + key, error);
      }

      return null;
    }

    function normalize(items) {
      const now = Date.now();
      return items.map((item, index) => {
        return {
          id: item.id || uniqueId(now + '-' + index),
          title: sanitize(item.title) || 'Todo ' + (index + 1),
          completed: Boolean(item.completed),
          createdAt: item.createdAt || now - index * 3600000,
          updatedAt: item.updatedAt || now - index * 1800000,
          priority: item.priority || ['low', 'medium', 'high'][index % 3]
        };
      });
    }
  }

  function createLocalLogAccumulator() {
    const storageKey = 'csma.todo-app.logs';

    return {
      log: function (type, payload) {
        try {
          const nextEntry = {
            type: type,
            payload: payload,
            timestamp: Date.now()
          };
          const current = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
          current.unshift(nextEntry);
          window.localStorage.setItem(storageKey, JSON.stringify(current.slice(0, 50)));
        } catch (error) {
          // Logging must not break the standalone demo.
        }
      }
    };
  }

  function sanitize(text) {
    if (typeof text !== 'string') {
      return '';
    }
    return text.replace(/\s+/g, ' ').trim();
  }

  function uniqueId(seed) {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (error) {
      // Ignore crypto access failures and use the fallback id path.
    }

    return 'todo-' + (seed || Date.now()) + '-' + Math.random().toString(16).slice(2);
  }
})();
