export class LifecycleScope {
    constructor(label = 'LifecycleScope') {
        this.label = label;
        this.cleanups = [];
        this.destroyed = false;
    }

    add(cleanup) {
        if (typeof cleanup !== 'function') {
            return cleanup;
        }

        if (this.destroyed) {
            try {
                cleanup();
            } catch (error) {
                console.error(`[${this.label}] Late cleanup failed:`, error);
            }
            return cleanup;
        }

        this.cleanups.push(cleanup);
        return cleanup;
    }

    listen(target, eventName, handler, options) {
        if (!target?.addEventListener || typeof handler !== 'function') {
            return () => {};
        }

        target.addEventListener(eventName, handler, options);
        return this.add(() => target.removeEventListener(eventName, handler, options));
    }

    subscribe(eventBus, eventName, handler) {
        if (!eventBus?.subscribe || !eventName || typeof handler !== 'function') {
            return () => {};
        }

        const unsubscribe = eventBus.subscribe(eventName, handler) || (() => {});
        return this.add(() => unsubscribe());
    }

    interval(timerId) {
        if (timerId == null) {
            return timerId;
        }
        this.add(() => clearInterval(timerId));
        return timerId;
    }

    timeout(timerId) {
        if (timerId == null) {
            return timerId;
        }
        this.add(() => clearTimeout(timerId));
        return timerId;
    }

    animationFrame(frameId) {
        if (frameId == null) {
            return frameId;
        }
        this.add(() => cancelAnimationFrame(frameId));
        return frameId;
    }

    observer(instance, method = 'disconnect') {
        if (!instance || typeof instance[method] !== 'function') {
            return instance;
        }

        this.add(() => instance[method]());
        return instance;
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        const pending = this.cleanups.splice(0).reverse();

        pending.forEach((cleanup) => {
            try {
                cleanup();
            } catch (error) {
                console.error(`[${this.label}] Cleanup failed:`, error);
            }
        });
    }
}

export function createLifecycleScope(label) {
    return new LifecycleScope(label);
}
