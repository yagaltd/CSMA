import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { contract, Contracts as BaseContracts } from '../src/runtime/Contracts.js';
import { object, string, number, boolean, enums, optional, size, array } from '../src/runtime/validation/index.js';
import { createTodoService } from '../examples/todo-app/services/TodoService.js';

const FILTERS = ['all', 'active', 'completed'];
const PRIORITIES = ['low', 'medium', 'high'];

const TodoContracts = {
  INTENT_TODO_CREATE: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User creates a task'
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
    description: 'User toggles task state'
  }, object({
    id: string(),
    timestamp: number()
  })),

  INTENT_TODO_DELETE: contract({
    version: 1,
    type: 'intent',
    owner: 'todo-app',
    description: 'User deletes a task'
  }, object({
    id: string(),
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

describe('Todo App Smoke Test', () => {
  let eventBus;
  let states;
  let teardown;

  beforeEach(() => {
    eventBus = new EventBus();
    eventBus.contracts = { ...BaseContracts, ...TodoContracts };
    states = [];
    eventBus.subscribe('TODO_STATE_CHANGED', (state) => {
      states.push(state);
    });
    teardown = createTodoService(eventBus, { seedFallback: false });
  });

  afterEach(() => {
    teardown?.();
  });

  it('handles create -> toggle -> delete flow', async () => {
    await waitFor(() => states.some((state) => state.reason === 'init'));

    await eventBus.publish('INTENT_TODO_CREATE', {
      title: 'Write release notes',
      timestamp: Date.now()
    });

    await waitFor(() => Boolean(latestState('created')));
    const createdState = latestState('created');
    expect(createdState.todos).toHaveLength(1);
    expect(createdState.stats.total).toBe(1);

    const todoId = createdState.todos[0].id;

    await eventBus.publish('INTENT_TODO_TOGGLE', {
      id: todoId,
      timestamp: Date.now()
    });

    await waitFor(() => Boolean(latestState('toggled')));
    const toggledState = latestState('toggled');
    expect(toggledState.todos[0].completed).toBe(true);
    expect(toggledState.stats.completed).toBe(1);

    await eventBus.publish('INTENT_TODO_DELETE', {
      id: todoId,
      timestamp: Date.now()
    });

    await waitFor(() => Boolean(latestState('deleted')));
    const deletedState = latestState('deleted');
    expect(deletedState.todos).toHaveLength(0);
    expect(deletedState.stats.total).toBe(0);
  });

  function latestState(reason) {
    for (let i = states.length - 1; i >= 0; i -= 1) {
      if (states[i].reason === reason) {
        return states[i];
      }
    }
    return null;
  }
});

function waitFor(predicate, timeout = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - start > timeout) {
        reject(new Error('waitFor timeout'));
        return;
      }
      setTimeout(tick, 10);
    };
    tick();
  });
}
