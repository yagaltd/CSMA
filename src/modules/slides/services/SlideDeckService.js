/**
 * SlideDeckService — single source of truth for deck state.
 *
 * Owns: current slide index, click-build step, per-slide max-clicks, annotations,
 * notes, and UI visibility flags. The DOM is a projection of this state — chrome
 * and layouts subscribe to SLIDE_* / BUILD_* / UI_STATE_CHANGED events and
 * update their CSS classes accordingly. No reconciliation, no virtual DOM.
 *
 * Every mutator is reached ONLY via a validated INTENT_* contract. The agent
 * drives the deck by publishing intents — no DOM access required.
 *
 * Cross-tab sync: if a BroadcastChannel named `csma-slides-sync` is available,
 * the main deck broadcasts state changes; the presenter tab (open via P key)
 * follows along. No leader election — single-presenter assumption.
 */

const SYNC_CHANNEL = 'csma-slides-sync';
const NOTES_STORAGE_PREFIX = 'csma-slides-notes-';

export class SlideDeckService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.slides = [];
        this.index = 0;
        this.clicks = 0;
        this.maxClicks = new Map();      // slide index → max build steps
        this.annotations = new Map();    // slide index → Stroke[]
        this.notes = new Map();          // slide index → string
        this.listeners = [];             // EventBus unsubscribe fns

        // UI state
        this.railOpen = false;
        this.gridOpen = false;
        this.drawing = false;
        this.fs = false;
        this.uiHidden = false;

        // Cross-tab
        this.syncChannel = null;
        this.isPresenter = false;
        this.windowRef = typeof window !== 'undefined' ? window : null;
        this.docRef = typeof document !== 'undefined' ? document : null;
        this.storageRef = this.windowRef?.localStorage || null;

        this._setupSubscriptions();
    }

    // ─── Lifecycle ───────────────────────────────────────────────────

    init(config) {
        const cfg = config || (this.windowRef && this.windowRef.__DECK_CONFIG__) || null;
        if (!cfg?.slides?.length) {
            console.warn('[SlideDeck] No slides configured');
            return;
        }
        this.slides = cfg.slides;
        this.isPresenter = Boolean(this.windowRef &&
            this.windowRef.location &&
            this.windowRef.location.search &&
            /[?&]presenter=1/.test(this.windowRef.location.search));

        // Hydrate notes from localStorage (device-scoped, same as bolt-slides)
        this._hydrateNotes();

        // Cross-tab sync — presenter listens, main deck broadcasts
        if (this.windowRef && typeof this.windowRef.BroadcastChannel === 'function') {
            this.syncChannel = new this.windowRef.BroadcastChannel(SYNC_CHANNEL);
            this.syncChannel.addEventListener('message', (e) => this._handleSyncMessage(e));
        }

        this.eventBus.publish('DECK_READY', {
            total: this.slides.length,
            config: cfg
        });
        this._syncHash(this.index);
    }

    destroy() {
        this.listeners.forEach((fn) => fn && fn());
        this.listeners = [];
        this.maxClicks.clear();
        this.annotations.clear();
        this.notes.clear();
        if (this.syncChannel) {
            try { this.syncChannel.close(); } catch { /* noop */ }
            this.syncChannel = null;
        }
        this.eventBus.publish('DECK_DESTROYED', {});
    }

    // ─── Intent subscriptions ────────────────────────────────────────

    _setupSubscriptions() {
        if (!this.eventBus?.subscribe) return;

        const sub = (name, handler) => {
            this.listeners.push(this.eventBus.subscribe(name, handler));
        };

        sub('INTENT_SLIDE_NEXT',  () => this.next());
        sub('INTENT_SLIDE_PREV',  () => this.prev());
        sub('INTENT_SLIDE_GO',    (p) => this.go(p?.index));
        sub('INTENT_SLIDE_FIRST', () => this.go(0));
        sub('INTENT_SLIDE_LAST',  () => this.go(this.slides.length - 1));
        sub('INTENT_SLIDE_TOGGLE_RAIL',    () => this.toggleRail());
        sub('INTENT_SLIDE_TOGGLE_GRID',    () => this.toggleGrid());
        sub('INTENT_SLIDE_TOGGLE_FS',      () => this.toggleFullscreen());
        sub('INTENT_SLIDE_TOGGLE_DRAWING', () => this.toggleDrawing());
        sub('INTENT_SLIDE_OPEN_PRESENTER', () => this.openPresenter());
        sub('INTENT_SLIDE_HIDE_UI',        () => this.toggleHideUi());
        sub('INTENT_SLIDE_ESCAPE',         () => this.handleEscape());
        sub('INTENT_SLIDE_TOGGLE_COMMENTS', (p) => this.toggleComments(p?.threadId));

        sub('INTENT_ANNOTATION_STROKE', (p) => this.addStroke(p));
        sub('INTENT_ANNOTATION_CLEAR',  (p) => this.clearAnnotations(p?.slide));
        sub('INTENT_ANNOTATION_UNDO',   (p) => this.undoStroke(p?.slide));

        sub('INTENT_SLIDE_NOTE_UPDATE', (p) => this.updateNote(p?.slide, p?.text));

        sub('INTENT_DECK_EXPORT_PNG', (p) => this.exportPng(p));
    }

    // ─── Surface embedding (Phase 2.2) ─────────────────────────────
    //
    // toggleComments(threadId?) — adds or removes an embedded comments-thread
    // surface on the current slide's `media` slot. Idempotent: clicking the
    // dock button again removes it. Other media types are preserved.
    //
    // The slide re-renders via SLIDE_MEDIA_CHANGED; deck.js subscribes and
    // re-mounts the affected slide.

    toggleComments(threadId) {
        if (!this.slides.length) return false;
        const idx = this.index;
        const slide = this.slides[idx];
        const currentMedia = slide?.media;
        const isCommentsActive = currentMedia?.type === 'surface'
            && currentMedia?.component === 'comments-thread';

        let nextMedia;
        if (isCommentsActive) {
            // Toggle off — remove the comments surface (set media to null).
            nextMedia = null;
        } else {
            // Toggle on — install a comments-thread surface.
            nextMedia = {
                type: 'surface',
                component: 'comments-thread',
                props: { threadId: threadId || `slide-${idx}-q-and-a` }
            };
        }

        this.slides[idx] = { ...slide, media: nextMedia };
        this.eventBus.publish('SLIDE_MEDIA_CHANGED', { index: idx, media: nextMedia });
        this._broadcastState();
        return true;
    }

    /**
     * Generic media slot setter (Phase 2.2 foundation for future surfaces).
     */
    setSlideMedia(index, media) {
        if (index < 0 || index >= this.slides.length) return false;
        this.slides[index] = { ...this.slides[index], media };
        this.eventBus.publish('SLIDE_MEDIA_CHANGED', { index, media });
        this._broadcastState();
        return true;
    }

    // ─── next() / prev() — the core click-build loop ─────────────────
    //
    // next(): if there are still build steps to reveal on the current slide,
    // advance clicks. Otherwise advance to the next slide (resetting clicks).
    // At end of deck, no-op.

    next() {
        if (!this.slides.length) return;
        const max = this.maxClicks.get(this.index) || 0;
        if (this.clicks < max) {
            this.clicks++;
            this.eventBus.publish('BUILD_ADVANCED', {
                slide: this.index, click: this.clicks, maxClicks: max
            });
            this._broadcastState();
            return;
        }
        if (this.index < this.slides.length - 1) {
            this.index++;
            this.clicks = 0;
            this._publishSlideChanged();
            return;
        }
        // at end — no-op
    }

    prev() {
        if (!this.slides.length) return;
        if (this.clicks > 0) {
            this.clicks--;
            const max = this.maxClicks.get(this.index) || 0;
            this.eventBus.publish('BUILD_ADVANCED', {
                slide: this.index, click: this.clicks, maxClicks: max
            });
            this._broadcastState();
            return;
        }
        if (this.index > 0) {
            this.index--;
            const max = this.maxClicks.get(this.index) || 0;
            // landing on previous slide → show all builds (we are going back)
            this.clicks = max;
            this._publishSlideChanged();
            return;
        }
        // at start — no-op
    }

    go(target) {
        if (!this.slides.length) return;
        if (!Number.isFinite(target)) return;
        const clamped = Math.max(0, Math.min(target, this.slides.length - 1));
        if (clamped === this.index) return;
        this.index = clamped;
        // landing on a slide via go() shows all builds (jump navigation)
        this.clicks = this.maxClicks.get(clamped) || 0;
        this._publishSlideChanged();
    }

    // ─── Build registration (called by Build elements on mount) ──────

    registerMax(at, slideIndex) {
        const idx = Number.isFinite(slideIndex) ? slideIndex : this.index;
        const n = Math.max(0, Number(at) || 0);
        const current = this.maxClicks.get(idx) || 0;
        if (n > current) {
            this.maxClicks.set(idx, n);
        }
    }

    // ─── UI state mutators ───────────────────────────────────────────

    toggleRail()   { this.railOpen   = !this.railOpen;   this._publishUiState(); }
    toggleGrid()   { this.gridOpen   = !this.gridOpen;   this._publishUiState(); }
    toggleDrawing(){ this.drawing    = !this.drawing;    this._publishUiState(); }

    toggleFullscreen() {
        const doc = this.docRef;
        const win = this.windowRef;
        if (!doc || !win) return;
        const isFs = doc.fullscreenElement || win.fullscreen;
        if (isFs) {
            this.fs = false;
            this._publishUiState();
            try { doc.exitFullscreen?.(); } catch { /* noop */ }
        } else {
            this.fs = true;
            this._publishUiState();
            const el = doc.documentElement;
            try { el?.requestFullscreen?.(); } catch { /* noop */ }
        }
    }

    toggleHideUi() { this.uiHidden = !this.uiHidden; this._publishUiState(); }

    handleEscape() {
        // Priority: grid → rail → drawing → fullscreen
        if (this.gridOpen)        { this.gridOpen = false;    this._publishUiState(); return; }
        if (this.railOpen)        { this.railOpen = false;    this._publishUiState(); return; }
        if (this.drawing)         { this.drawing = false;     this._publishUiState(); return; }
        if (this.fs)              { this.toggleFullscreen(); }
    }

    openPresenter() {
        const win = this.windowRef;
        if (!win) return;
        const url = (win.location.href || '') + (/[?]/.test(win.location.search) ? '&' : '?') + 'presenter=1';
        try { win.open(url, 'csma-slides-presenter'); } catch { /* noop */ }
    }

    // ─── Annotations ─────────────────────────────────────────────────

    addStroke({ slide, points, color, width } = {}) {
        const idx = Number.isFinite(slide) ? slide : this.index;
        if (!Array.isArray(points) || points.length === 0) return;
        const list = this.annotations.get(idx) || [];
        list.push({
            points: points.map((p) => ({ x: Number(p?.x) || 0, y: Number(p?.y) || 0 })),
            color: typeof color === 'string' ? color : 'currentColor',
            width: Number.isFinite(width) ? width : 3
        });
        this.annotations.set(idx, list);
        this.eventBus.publish('ANNOTATION_UPDATED', { slide: idx, strokes: list });
    }

    clearAnnotations(slide) {
        const idx = Number.isFinite(slide) ? slide : this.index;
        this.annotations.set(idx, []);
        this.eventBus.publish('ANNOTATION_UPDATED', { slide: idx, strokes: [] });
    }

    undoStroke(slide) {
        const idx = Number.isFinite(slide) ? slide : this.index;
        const list = this.annotations.get(idx) || [];
        if (list.length === 0) return;
        list.pop();
        this.annotations.set(idx, list);
        this.eventBus.publish('ANNOTATION_UPDATED', { slide: idx, strokes: list });
    }

    getAnnotations(slide) {
        const idx = Number.isFinite(slide) ? slide : this.index;
        return this.annotations.get(idx) || [];
    }

    // ─── Notes ───────────────────────────────────────────────────────

    updateNote(slide, text) {
        const idx = Number.isFinite(slide) ? slide : this.index;
        const value = typeof text === 'string' ? text.slice(0, 5000) : '';
        this.notes.set(idx, value);
        this._persistNote(idx, value);
    }

    getNote(slide) {
        const idx = Number.isFinite(slide) ? slide : this.index;
        return this.notes.get(idx) || '';
    }

    _hydrateNotes() {
        if (!this.storageRef) return;
        for (let i = 0; i < this.slides.length; i++) {
            try {
                const raw = this.storageRef.getItem(NOTES_STORAGE_PREFIX + i);
                if (raw) this.notes.set(i, raw);
            } catch { /* storage may be blocked */ }
        }
    }

    _persistNote(idx, value) {
        if (!this.storageRef) return;
        try {
            this.storageRef.setItem(NOTES_STORAGE_PREFIX + idx, value);
        } catch { /* storage may be full or blocked */ }
    }

    // ─── Export (stub — full impl uses media module) ─────────────────

    async exportPng({ slide, width, height, scale } = {}) {
        // Phase 5 stub — emits a not-implemented note. Full impl uses media.CanvasCodec.
        const idx = Number.isFinite(slide) ? slide : this.index;
        console.warn('[SlideDeck] PNG export is a stub in v1 — wire media.CanvasCodec for full impl', { slide: idx, width, height, scale });
        return null;
    }

    // ─── Helpers ─────────────────────────────────────────────────────

    getCurrentSlide() {
        return this.slides[this.index] || null;
    }

    _publishSlideChanged() {
        this.eventBus.publish('SLIDE_CHANGED', {
            slide: this.index,
            total: this.slides.length,
            clicks: this.clicks
        });
        this._syncHash(this.index);
        this._broadcastState();
    }

    _publishUiState() {
        this.eventBus.publish('UI_STATE_CHANGED', {
            railOpen: this.railOpen,
            gridOpen: this.gridOpen,
            drawing: this.drawing,
            fs: this.fs,
            uiHidden: this.uiHidden
        });
    }

    _syncHash(idx) {
        const win = this.windowRef;
        if (!win?.history?.replaceState) return;
        try {
            const newHash = '#' + (idx + 1);
            if (win.location.hash !== newHash) {
                win.history.replaceState(null, '', newHash);
            }
        } catch { /* hash sync best-effort */ }
    }

    // ─── Cross-tab sync ──────────────────────────────────────────────

    _broadcastState() {
        if (!this.syncChannel || this.isPresenter) return;
        try {
            this.syncChannel.postMessage({ type: 'state', slide: this.index, clicks: this.clicks });
        } catch { /* channel closed */ }
    }

    _handleSyncMessage(e) {
        const msg = e?.data;
        if (!msg || msg.type !== 'state') return;
        if (!this.isPresenter) return; // only presenter follows
        if (!Number.isFinite(msg.slide)) return;
        this.index = msg.slide;
        this.clicks = Number.isFinite(msg.clicks) ? msg.clicks : 0;
        this.eventBus.publish('PRESENTER_SYNC', {
            slide: this.index,
            clicks: this.clicks
        });
    }
}
