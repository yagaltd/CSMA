/**
 * BroadcastSync — multi-tab synchronisation helper for the history module.
 *
 * Wraps BroadcastChannel (when available) so that multiple tabs sharing the
 * same history store (same dbName/storeName) reload from the store when one
 * tab writes. Single-tab leader election is intentionally out of scope for
 * v1 (see plan.md open question #3).
 *
 * Extracted from the former ActionLogService's BroadcastChannel wiring.
 */

const DEFAULT_CHANNEL_NAME = 'csma-history';

export class BroadcastSync {
    constructor({ channelName = DEFAULT_CHANNEL_NAME, onMessage } = {}) {
        this.channelName = channelName;
        this.onMessage = typeof onMessage === 'function' ? onMessage : null;
        this.channel = null;
        this._messageHandler = this._messageHandler.bind(this);
    }

    init() {
        if (typeof BroadcastChannel === 'undefined') {
            return;
        }
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.addEventListener('message', this._messageHandler);
    }

    destroy() {
        if (!this.channel) return;
        this.channel.removeEventListener('message', this._messageHandler);
        this.channel.close();
        this.channel = null;
    }

    postMessage(message) {
        if (!this.channel) return;
        try {
            this.channel.postMessage(message);
        } catch (error) {
            console.warn('[BroadcastSync] postMessage failed:', error);
        }
    }

    _messageHandler(event) {
        if (typeof this.onMessage !== 'function') return;
        try {
            this.onMessage(event?.data, event);
        } catch (error) {
            console.warn('[BroadcastSync] onMessage handler threw:', error);
        }
    }
}

export { DEFAULT_CHANNEL_NAME };
