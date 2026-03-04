import { threadManager } from '../../../src/runtime/ThreadManager.js';
import { LogAccumulator } from '../../../src/runtime/LogAccumulator.js';

const DEFAULT_STORAGE_KEY = 'csma.todo-app';
const FALLBACK_SEED = [
  { title: 'Draft copy for marketing site', completed: false },
  { title: 'Wireframe dashboard empty states', completed: true },
  { title: 'Prepare accessibility checklist', completed: false }
];

const WORKER_ID = 'todo-insights-worker';
const WORKER_URL = new URL('../workers/todoInsights.worker.js', import.meta.url);

export function createTodoService(eventBus, options = {}) {
  const storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
  const storage = resolveStorage();
  let filter = options.initialFilter || 'all';
  const seedFallback = options.seedFallback !== false;
  const legacyKeys = options.legacyKeys || ['todo-items', 'todos'];
  let todos = loadInitialTodos(storageKey, legacyKeys, seedFallback);
  let activity = [];
  const workerRequests = new Map();
  let workerEnabled = false;
  let workerUnsubscribe = null;

  setupWorker();

  const subscriptions = [
    eventBus.subscribe('INTENT_TODO_CREATE', handleCreate),
    eventBus.subscribe('INTENT_TODO_TOGGLE', handleToggle),
    eventBus.subscribe('INTENT_TODO_DELETE', handleDelete),
    eventBus.subscribe('INTENT_TODO_UPDATE', handleUpdate),
    eventBus.subscribe('INTENT_TODO_CLEAR_COMPLETED', handleClearCompleted),
    eventBus.subscribe('INTENT_TODO_FILTER', handleFilterChange)
  ];

  emitChange('init');

  function handleCreate(payload) {
    const title = sanitize(payload?.title);
    if (!title) return;
    const now = Date.now();
    const newTodo = {
      id: payload?.id || uniqueId(now),
      title,
      completed: Boolean(payload?.completed) || false,
      createdAt: now,
      updatedAt: now,
      priority: payload?.priority || 'medium'
    };
    todos = [newTodo, ...todos];
    persist();
    track(`${title} added`);
    emitChange('created');
  }

  function handleToggle({ id }) {
    todos = todos.map((todo) => {
      if (todo.id !== id) return todo;
      const next = { ...todo, completed: !todo.completed, updatedAt: Date.now() };
      track(`${todo.title} marked ${next.completed ? 'done' : 'active'}`);
      return next;
    });
    persist();
    emitChange('toggled');
  }

  function handleDelete({ id }) {
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;
    todos = todos.filter((todo) => todo.id !== id);
    persist();
    track(`${target.title} removed`);
    emitChange('deleted');
  }

  function handleUpdate({ id, title }) {
    const nextTitle = sanitize(title);
    if (!nextTitle) return;
    todos = todos.map((todo) => {
      if (todo.id !== id) return todo;
      return { ...todo, title: nextTitle, updatedAt: Date.now() };
    });
    persist();
    track(`${nextTitle} updated`);
    emitChange('updated');
  }

  function handleClearCompleted() {
    const removed = todos.filter((todo) => todo.completed).length;
    todos = todos.filter((todo) => !todo.completed);
    if (removed) {
      persist();
      track(`${removed} completed tasks cleared`);
      emitChange('clear-completed');
    }
  }

  function handleFilterChange({ filter: nextFilter }) {
    if (!nextFilter) return;
    filter = nextFilter;
    emitChange('filter-changed');
  }

  function emitChange(reason) {
    computeMetrics(todos)
      .then(({ stats, insights }) => {
        eventBus.publish('TODO_STATE_CHANGED', {
          todos,
          filter,
          reason,
          stats,
          insights,
          activity,
          timestamp: Date.now()
        });
      })
      .catch(() => {
        eventBus.publish('TODO_STATE_CHANGED', {
          todos,
          filter,
          reason,
          stats: buildStats(),
          insights: buildInsights(),
          activity,
          timestamp: Date.now()
        });
      });
  }

  function setupWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return;
    if (workerEnabled) return;
    try {
      threadManager.spawn(WORKER_ID, WORKER_URL, { type: 'module' });
      workerUnsubscribe = threadManager.subscribe(WORKER_ID, handleWorkerMessage);
      workerEnabled = true;
    } catch (error) {
      console.warn('[TodoService] Unable to initialize worker', error);
      workerEnabled = false;
    }
  }

  function handleWorkerMessage(event) {
    const { data } = event;
    if (!data || !data.requestId) return;
    const pending = workerRequests.get(data.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    workerRequests.delete(data.requestId);
    pending.resolve({
      stats: data.stats || buildStats(),
      insights: data.insights || buildInsights()
    });
  }

  function computeMetrics(currentTodos) {
    if (!workerEnabled) {
      return Promise.resolve({
        stats: buildStats(currentTodos),
        insights: buildInsights(currentTodos)
      });
    }

    return new Promise((resolve) => {
      const requestId = uniqueId('metrics');
      const timeout = setTimeout(() => {
        workerRequests.delete(requestId);
        workerEnabled = false;
        resolve({ stats: buildStats(currentTodos), insights: buildInsights(currentTodos) });
      }, 300);

      workerRequests.set(requestId, { resolve, timeout });

      try {
        threadManager.postMessage(WORKER_ID, {
          requestId,
          todos: currentTodos
        });
      } catch (error) {
        clearTimeout(timeout);
        workerRequests.delete(requestId);
        workerEnabled = false;
        resolve({ stats: buildStats(currentTodos), insights: buildInsights(currentTodos) });
      }
    });
  }

  function persist() {
    try {
      storage.setItem(storageKey, JSON.stringify(todos));
    } catch (err) {
      console.warn('[TodoService] Unable to persist todos', err);
    }
  }

  function track(message) {
    activity = [{ message, timestamp: Date.now() }, ...activity].slice(0, 6);
    
    if (typeof window !== 'undefined' && window.csma?.logAccumulator) {
      window.csma.logAccumulator.track('Todo Action', {
        message,
        action: 'todo-crud'
      });
    }
  }

  function buildStats(source = todos) {
    const total = source.length;
    const completed = source.filter((todo) => todo.completed).length;
    const active = total - completed;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    return { total, completed, active, completionRate };
  }

  function buildInsights(source = todos, stats = buildStats(source)) {
    const focus = source.find((todo) => !todo.completed);
    const lastUpdated = source.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    return {
      completionRate: stats.completionRate,
      focusTask: focus?.title || 'All caught up',
      lastUpdated: lastUpdated ? lastUpdated.updatedAt : null
    };
  }

  function sanitize(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function loadInitialTodos(primaryKey, legacyKeysList, seed = true) {
    const candidate = readTodos(primaryKey) ?? legacyKeysList.reduce((acc, key) => acc ?? readTodos(key), null);
    if (candidate) return candidate;
    return seed ? normalize(FALLBACK_SEED) : [];
  }

  function readTodos(key) {
    if (!key) return null;
    try {
      const raw = storage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalize(parsed);
    } catch (err) {
      console.warn(`[TodoService] Failed to parse stored todos for key ${key}`, err);
    }
    return null;
  }

  function resolveStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (err) {
      console.warn('[TodoService] localStorage unavailable', err);
    }
    return {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {}
    };
  }

  function normalize(items) {
    const now = Date.now();
    return items.map((item, index) => ({
      id: item.id || uniqueId(`${now}-${index}`),
      title: sanitize(item.title) || `Todo ${index + 1}`,
      completed: Boolean(item.completed),
      createdAt: item.createdAt || now - index * 3600000,
      updatedAt: item.updatedAt || now - index * 1800000,
      priority: item.priority || ['low', 'medium', 'high'][index % 3]
    }));
  }

  return () => {
    subscriptions.forEach((off) => off && off());
    workerRequests.clear();
    workerUnsubscribe?.();
    if (workerEnabled) {
      threadManager.terminate(WORKER_ID);
      workerEnabled = false;
    }
  };

  function uniqueId(seed) {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
    } catch (err) {
      console.warn('[TodoService] crypto unavailable', err);
    }
    return `todo-${seed || Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
