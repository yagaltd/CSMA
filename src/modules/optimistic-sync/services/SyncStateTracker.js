/**
 * SyncStateTracker — optimistic-sync's overlay on top of the history log.
 *
 * HistoryService owns the LOG (record, undo, redo, query, persistence).
 * SyncStateTracker owns the SYNC STATE for entries the local tab is trying
 * to push to the server: pending (in flight), acked (server confirmed,
 * removed from local log), failed (terminal error).
 *
 * Extracted from the former ActionLogService's markAcked / markFailed /
 * getPending / updatePayload methods. Those methods mutated the entry's
 * `status` field directly; this tracker keeps state in a separate Map so
 * the history log remains sync-agnostic.
 *
 * Lifecycle: created and initialised by OptimisticSyncService. Receives a
 * reference to the HistoryService instance so it can read/mutate entries.
 */
export class SyncStateTracker {
    constructor({ history, eventBus }) {
        if (!history) {
            throw new Error('[SyncStateTracker] history is required');
        }
        this.history = history;
        this.eventBus = eventBus || null;
        this.states = new Map(); // entryId -> { status, attempts, lastError, terminal }
    }

    /**
     * Returns entries currently considered in-flight: every history entry
     * whose tracker state is 'pending' (or untracked, which defaults to
     * 'pending'). Acked entries have been removed from history by markAcked,
     * so they will not appear here.
     */
    getPending() {
        return this.history.getAll().filter((entry) => {
            const state = this.states.get(entry.id);
            return !state || state.status === 'pending';
        });
    }

    hasEntry(id) {
        return this.history.hasEntry(id);
    }

    /**
     * Marks an entry as acknowledged by the server. The entry is removed
     * from the local history log (it is committed; no local undo).
     * Publishes OPTIMISTIC_ACTION_ACKED with the removed entry.
     */
    markAcked(id) {
        const entry = this.history.getEntry(id);
        if (!entry) return;
        this.states.set(id, { status: 'acked', attempts: 0 });
        this.history.removeEntry(id);
        this.eventBus?.publish?.('OPTIMISTIC_ACTION_ACKED', { entry });
    }

    /**
     * Marks an entry as failed. Non-terminal failures keep status 'pending'
     * (so the next flush retries); terminal failures move to 'failed'.
     * Publishes OPTIMISTIC_ACTION_FAILED with the entry and error.
     */
    markFailed(id, error, { terminal = false } = {}) {
        const entry = this.history.getEntry(id);
        if (!entry) return;
        const prev = this.states.get(id) || { attempts: 0 };
        const next = {
            status: terminal ? 'failed' : 'pending',
            attempts: (prev.attempts || 0) + 1,
            lastError: error ? String(error) : undefined,
            terminal: terminal === true
        };
        this.states.set(id, next);
        // Persist attempts/lastError on the entry for visibility (matches
        // former ActionLogService behavior).
        this.history.updateEntry(id, {
            attempts: next.attempts,
            lastError: next.lastError,
            status: terminal ? 'failed' : 'recorded'
        });
        this.eventBus?.publish?.('OPTIMISTIC_ACTION_FAILED', {
            entry: this.history.getEntry(id) || entry,
            terminal,
            error: next.lastError
        });
    }

    /**
     * Updates an entry's payload before a retry. Persists the change.
     */
    updatePayload(id, payload) {
        if (!this.history.hasEntry(id)) return;
        this.history.updateEntry(id, { payload });
    }

    /**
     * Returns the recorded state for an entry (or undefined if untracked).
     */
    getState(id) {
        return this.states.get(id);
    }

    /**
     * Clears all tracked state. Does not modify history entries.
     */
    reset() {
        this.states.clear();
    }
}
