import { uid } from '../../../utils/id.js';

const DEFAULT_OPTIONS = {
    maxStack: 3
};

export class ModalService {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.stack = [];
        this.subscriptions = [];
    }

    init() {
        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('INTENT_MODAL_OPEN', (payload = {}) => this.open(payload).catch((error) => this.#handleError('open', error))),
                this.eventBus.subscribe('INTENT_MODAL_CLOSE', (payload = {}) => this.close(payload.id || payload.modalId).catch((error) => this.#handleError('close', error))),
                this.eventBus.subscribe('INTENT_MODAL_CLOSE_ALL', () => this.closeAll())
            );
        }
    }

    async open({ id, modalId, title, component, props = {}, modalType = 'default', blocking = false }) {
        const resolvedId = id || modalId;
        const stackId = resolvedId || this.#generateId('modal');
        const entry = {
            id: stackId,
            title,
            component,
            modalType,
            blocking,
            props,
            openedAt: Date.now()
        };

        // Remove if already exists
        this.stack = this.stack.filter((m) => m.id !== stackId);
        this.stack.push(entry);

        if (this.stack.length > this.options.maxStack) {
            this.stack.shift();
        }

        this.#publishStack();
        return entry;
    }

    async close(id) {
        if (!id && this.stack.length === 0) {
            return;
        }

        if (!id) {
            this.stack.pop();
        } else {
            this.stack = this.stack.filter((modal) => modal.id !== id);
        }

        this.#publishStack();
    }

    closeAll() {
        if (this.stack.length === 0) {
            return;
        }
        this.stack = [];
        this.#publishStack();
    }

    getStack() {
        return this.stack.map((modal) => ({ ...modal }));
    }

    destroy() {
        this.closeAll();
        this.subscriptions.forEach((unsubscribe) => unsubscribe && unsubscribe());
        this.subscriptions = [];
    }

    #publishStack() {
        this.eventBus?.publish('MODAL_STACK_UPDATED', {
            stack: this.stack.map(({ id, title, component, modalType, blocking }) => ({
                id,
                title,
                component,
                modalType,
                blocking
            })),
            timestamp: Date.now()
        });
    }

    #handleError(operation, error) {
        console.warn('[ModalService]', operation, error);
        this.eventBus?.publish('MODAL_ERROR', {
            error: error?.message || String(error),
            operation
        });
    }

    #generateId(prefix) {
        return uid(prefix);
    }
}
