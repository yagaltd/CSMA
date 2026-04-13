const DEFAULT_STORAGE_KEY = 'csma_leader_state';
const DEFAULT_LOCK_NAME = 'csma_leader_lock';
const DEFAULT_LEASE_MS = 5000;

export class CrossTabLeader {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus;
        this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
        this.lockName = options.lockName || DEFAULT_LOCK_NAME;
        this.leaseDuration = options.leaseDuration || DEFAULT_LEASE_MS;
        this.tabId = options.tabId || CrossTabLeader._createTabId();

        this.win = options.window || (typeof window !== 'undefined' ? window : null);
        this.storage = options.storage !== undefined
            ? options.storage
            : this.win?.localStorage ?? null;
        this.locks = options.locks !== undefined
            ? options.locks
            : this.win?.navigator?.locks ?? null;

        this.role = 'initializing';
        this.isLeaderFlag = false;
        this.lockAbortController = null;
        this.releaseLock = null;
        this.leaseTimer = null;
        this.staleCheckTimer = null;

        this.handleStorageEvent = this.handleStorageEvent.bind(this);
        this.handleVisibility = this.handleVisibility.bind(this);
    }

    async init() {
        if (!this.win) {
            this._becomeLeader('no-window');
            return;
        }

        this.win.addEventListener('storage', this.handleStorageEvent);
        this.win.addEventListener('pagehide', this.handleVisibility);
        this.win.addEventListener('beforeunload', this.handleVisibility);

        await this._attemptLeadership();
    }

    destroy(reason = 'destroy') {
        this._shutdownLeadership(reason);

        if (this.win) {
            this.win.removeEventListener('storage', this.handleStorageEvent);
            this.win.removeEventListener('pagehide', this.handleVisibility);
            this.win.removeEventListener('beforeunload', this.handleVisibility);
        }
    }

    isLeader() {
        return this.isLeaderFlag;
    }

    getTabId() {
        return this.tabId;
    }

    _attemptLeadership() {
        if (this.locks) {
            return this._acquireNavigatorLock();
        }

        this._attemptLeaseClaim();
        return Promise.resolve();
    }

    _acquireNavigatorLock() {
        this.lockAbortController = new AbortController();

        return this.locks.request(
            this.lockName,
            { signal: this.lockAbortController.signal },
            async () => {
                this._becomeLeader('lock-acquired');

                await new Promise((resolve) => {
                    this.releaseLock = () => {
                        this._relinquishLeader('lock-released');
                        resolve();
                    };
                });
            }
        ).catch((err) => {
            if (err?.name === 'AbortError') return;
            console.warn('[CrossTabLeader] Failed to acquire navigator lock, falling back:', err);
            this._attemptLeaseClaim();
        });
    }

    _attemptLeaseClaim() {
        if (!this.storage) {
            this._becomeLeader('no-storage');
            return;
        }

        const info = this._readState();
        const now = Date.now();

        if (!info || now - info.timestamp > this.leaseDuration) {
            this._writeState({ tabId: this.tabId, role: 'leader', timestamp: now });
            this._becomeLeader('lease-claimed');
            this._beginLeaseRenewal();
        } else {
            this.role = 'follower';
            this.isLeaderFlag = false;
            this._broadcastState('lease-watch');
            this._scheduleLeaseProbe();
        }
    }

    _beginLeaseRenewal() {
        this._clearLeaseTimers();
        this.leaseTimer = setInterval(() => {
            if (!this.isLeaderFlag) {
                this._clearLeaseTimers();
                return;
            }
            this._writeState({ tabId: this.tabId, role: 'leader', timestamp: Date.now() });
        }, Math.max(500, this.leaseDuration / 2));
    }

    _scheduleLeaseProbe() {
        this._clearLeaseTimers();
        this.staleCheckTimer = setInterval(() => {
            if (this.isLeaderFlag) return;
            const info = this._readState();
            if (!info || Date.now() - info.timestamp > this.leaseDuration) {
                this._attemptLeaseClaim();
            }
        }, Math.max(1000, this.leaseDuration));
    }

    _clearLeaseTimers() {
        if (this.leaseTimer) {
            clearInterval(this.leaseTimer);
            this.leaseTimer = null;
        }
        if (this.staleCheckTimer) {
            clearInterval(this.staleCheckTimer);
            this.staleCheckTimer = null;
        }
    }

    handleStorageEvent(event) {
        if (event.key !== this.storageKey || !event.newValue) return;

        try {
            const state = JSON.parse(event.newValue);
            if (state.tabId === this.tabId) return;

            if (state.role === 'leader') {
                this.isLeaderFlag = false;
                this.role = 'follower';
            }
            this.eventBus?.publish('LEADER_STATE_CHANGED', {
                tabId: this.tabId,
                role: this.role,
                leaderTabId: state.tabId,
                reason: 'storage-update',
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('[CrossTabLeader] Storage event parse failed:', error);
        }
    }

    handleVisibility() {
        this._shutdownLeadership('tab-hide');
    }

    _shutdownLeadership(reason) {
        if (this.releaseLock) {
            this.releaseLock();
            this.releaseLock = null;
        }
        if (this.lockAbortController) {
            this.lockAbortController.abort();
            this.lockAbortController = null;
        }
        this._clearLeaseTimers();

        if (this.isLeaderFlag) {
            this._relinquishLeader(reason);
        }
    }

    _becomeLeader(reason) {
        if (this.isLeaderFlag) {
            this._broadcastState(reason);
            return;
        }

        this.isLeaderFlag = true;
        this.role = 'leader';
        this._broadcastState(reason);
        this.eventBus?.publish('LEADER_STATE_CHANGED', {
            tabId: this.tabId,
            role: 'leader',
            reason,
            timestamp: Date.now()
        });
    }

    _relinquishLeader(reason) {
        this.isLeaderFlag = false;
        this.role = 'follower';
        this._broadcastState(reason);
        this.eventBus?.publish('LEADER_STATE_CHANGED', {
            tabId: this.tabId,
            role: 'follower',
            reason,
            timestamp: Date.now()
        });
    }

    _broadcastState(reason) {
        if (!this.storage) return;
        const payload = {
            tabId: this.isLeaderFlag ? this.tabId : null,
            role: this.role,
            reason,
            timestamp: Date.now()
        };
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(payload));
        } catch (error) {
            console.warn('[CrossTabLeader] Failed to write leader state:', error);
        }
    }

    _readState() {
        if (!this.storage) return null;
        try {
            const raw = this.storage.getItem(this.storageKey);
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            console.warn('[CrossTabLeader] Failed to read leader state:', error);
            return null;
        }
    }

    _writeState(value) {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(value));
        } catch (error) {
            console.warn('[CrossTabLeader] Failed to write state:', error);
        }
    }

    static _createTabId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `tab-${Math.random().toString(36).slice(2)}`;
    }
}
