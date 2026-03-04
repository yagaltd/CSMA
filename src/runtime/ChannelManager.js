export class ChannelManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.channels = new Map();
        this.activeSubscriptions = new Map();
        this.channelSubscriptions = new Map();
        this.desiredSubscriptions = new Map();
        this.contextResolver = null;
    }

    setContextResolver(resolver) {
        this.contextResolver = typeof resolver === 'function' ? resolver : null;
    }

    registerChannel(id, config = {}) {
        if (!id || typeof config !== 'object') {
            throw new Error('[ChannelManager] registerChannel requires an id and config');
        }
        this.channels.set(id, {
            access: config.access,
            load: config.load,
            unload: config.unload,
            onReplay: config.onReplay,
            onInvalidate: config.onInvalidate,
            metadata: config.metadata || {}
        });
    }

    subscribe(id, params = {}) {
        const channel = this.channels.get(id);
        if (!channel) {
            throw new Error(`[ChannelManager] Channel ${id} is not registered`);
        }
        const context = this._createContext(params);
        if (channel.access && channel.access(params, context) === false) {
            return () => {};
        }

        const key = this._subscriptionKey(id, params);
        if (this.activeSubscriptions.has(key)) {
            return this.activeSubscriptions.get(key).unsubscribe;
        }

        const loadContext = context;
        const cleanup = channel.load?.(context) || (() => {});
        const subscription = {
            id,
            params,
            filter: null,
            handlers: {
                onReplay: channel.onReplay,
                onInvalidate: channel.onInvalidate
            },
            cleanup,
            loadContext,
            unsubscribe: () => this._teardownSubscription(key, subscription, { source: 'manual' })
        };

        this.activeSubscriptions.set(key, subscription);
        this.desiredSubscriptions.set(key, { id, params });
        this._addChannelSubscription(id, subscription);
        this.eventBus?.publish('CHANNEL_SUBSCRIBED', { id, params });
        return subscription.unsubscribe;
    }

    isSubscribed(id, params = {}) {
        return this.activeSubscriptions.has(this._subscriptionKey(id, params));
    }

    listChannels() {
        return Array.from(this.channels.keys());
    }

    listSubscriptions() {
        return Array.from(this.desiredSubscriptions.values());
    }

    updateFilter(id, params = {}, filter = null) {
        const key = this._subscriptionKey(id, params);
        const subscription = this.activeSubscriptions.get(key);
        if (!subscription) return false;
        subscription.filter = filter || null;
        this.eventBus?.publish('CHANNEL_COMMAND_REQUEST', {
            id,
            params,
            command: 'filter',
            args: { filter }
        });
        return true;
    }

    requestResend(id, params = {}, reason = 'manual-resend') {
        const key = this._subscriptionKey(id, params);
        if (!this.desiredSubscriptions.has(key)) return false;
        this.eventBus?.publish('CHANNEL_COMMAND_REQUEST', {
            id,
            params,
            command: 'resend',
            args: { reason }
        });
        return true;
    }

    notifyContextChanged(reason = 'context-update') {
        this.reevaluateAccess();
        for (const { id, params } of this.desiredSubscriptions.values()) {
            this.eventBus?.publish('CHANNEL_COMMAND_REQUEST', {
                id,
                params,
                command: 'resend',
                args: { reason }
            });
        }
    }

    reevaluateAccess() {
        for (const [key, subscription] of Array.from(this.activeSubscriptions.entries())) {
            const channel = this.channels.get(subscription.id);
            if (!channel?.access) continue;
            const context = this._createContext(subscription.params);
            const allowed = channel.access(subscription.params, context) !== false;
            if (!allowed) {
                this._teardownSubscription(key, subscription, { source: 'access-revoked' });
                this.eventBus?.publish('CHANNEL_ACCESS_REVOKED', {
                    id: subscription.id,
                    params: subscription.params
                });
            }
        }
    }

    handleReplay(payload = {}) {
        if (!Array.isArray(payload.intents)) return;
        if (payload.channel && payload.params) {
            this._deliverToSubscription(payload.channel, payload.params, payload.intents, payload, 'onReplay');
            return;
        }
        for (const entry of payload.intents) {
            const channels = this._extractChannels(entry);
            for (const channelId of channels) {
                const subs = this.channelSubscriptions.get(channelId);
                if (!subs) continue;
                for (const subscription of subs) {
                    subscription.handlers?.onReplay?.(entry, {
                        channel: channelId,
                        params: subscription.params,
                        reason: payload.reason,
                        cursor: payload.cursor
                    });
                }
            }
        }
    }

    handleInvalidate(payload = {}) {
        if (!Array.isArray(payload.intents)) return;
        if (payload.channel && payload.params) {
            this._deliverToSubscription(payload.channel, payload.params, payload.intents, payload, 'onInvalidate');
            return;
        }
        for (const entry of payload.intents) {
            const channels = this._extractChannels(entry);
            for (const channelId of channels) {
                const subs = this.channelSubscriptions.get(channelId);
                if (!subs) continue;
                for (const subscription of subs) {
                    subscription.handlers?.onInvalidate?.(entry, {
                        channel: channelId,
                        params: subscription.params,
                        reason: payload.reason
                    });
                }
            }
        }
    }

    handleClose(message = {}) {
        if (!message.channel) return;
        const key = this._subscriptionKey(message.channel, message.params || {});
        const subscription = this.activeSubscriptions.get(key);
        if (!subscription) return;
        this._teardownSubscription(key, subscription, { source: 'server-close' });
        this.eventBus?.publish('CHANNEL_SERVER_CLOSE', {
            channel: message.channel,
            params: subscription.params,
            code: message.code,
            reason: message.reason
        });
    }

    handleCommandResult(message = {}) {
        if (message.status !== 'ok' || !message.channel || !message.params) return;
        if (message.command === 'filter') {
            const key = this._subscriptionKey(message.channel, message.params);
            const subscription = this.activeSubscriptions.get(key);
            if (subscription) {
                subscription.filter = message.filter || null;
            }
        }
    }

    _deliverToSubscription(channelId, params, intents, payload, handlerKey) {
        const key = this._subscriptionKey(channelId, params);
        const subscription = this.activeSubscriptions.get(key);
        if (!subscription) return;
        for (const entry of intents) {
            if (!this._passesFilter(subscription, entry)) {
                continue;
            }
            subscription.handlers?.[handlerKey]?.(entry, {
                channel: channelId,
                params: subscription.params,
                reason: payload.reason,
                cursor: payload.cursor
            });
        }
    }

    _passesFilter(subscription, entry) {
        if (!subscription.filter) return true;
        if (typeof subscription.filter === 'function') {
            try {
                return subscription.filter(entry) !== false;
            } catch (error) {
                console.warn('[ChannelManager] filter callback failed', error);
                return true;
            }
        }
        if (subscription.filter && typeof subscription.filter === 'object') {
            return Object.entries(subscription.filter).every(([key, value]) => {
                return entry.payload?.[key] === value;
            });
        }
        return true;
    }

    _teardownSubscription(key, subscription, { source } = {}) {
        this.activeSubscriptions.delete(key);
        this._removeChannelSubscription(subscription.id, subscription);
        try {
            subscription.cleanup?.();
            const channel = this.channels.get(subscription.id);
            channel?.unload?.(subscription.loadContext || this._createContext(subscription.params));
        } catch (error) {
            console.warn('[ChannelManager] Failed to unload channel', error);
        }
        if (source === 'manual') {
            this.desiredSubscriptions.delete(key);
        }
        this.eventBus?.publish('CHANNEL_UNSUBSCRIBED', { id: subscription.id, params: subscription.params, source });
    }

    _subscriptionKey(id, params) {
        return `${id}:${this._stableStringify(params)}`;
    }

    _extractChannels(entry = {}) {
        const channels = entry.meta?.channels;
        if (Array.isArray(channels) && channels.length) {
            return channels;
        }
        return ['global'];
    }

    _createContext(params) {
        return {
            eventBus: this.eventBus,
            params,
            user: this.contextResolver?.() || null
        };
    }

    _addChannelSubscription(channelId, subscription) {
        if (!this.channelSubscriptions.has(channelId)) {
            this.channelSubscriptions.set(channelId, new Set());
        }
        this.channelSubscriptions.get(channelId).add(subscription);
    }

    _removeChannelSubscription(channelId, subscription) {
        const set = this.channelSubscriptions.get(channelId);
        if (!set) return;
        set.delete(subscription);
        if (set.size === 0) {
            this.channelSubscriptions.delete(channelId);
        }
    }

    _stableStringify(value) {
        if (Array.isArray(value)) {
            return `[${value.map((item) => this._stableStringify(item)).join(',')}]`;
        }
        if (value && typeof value === 'object') {
            const ordered = {};
            for (const key of Object.keys(value).sort()) {
                ordered[key] = value[key];
            }
            return JSON.stringify(ordered);
        }
        return JSON.stringify(value);
    }
}
