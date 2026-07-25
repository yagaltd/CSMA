/**
 * VideoCompositionService — FORWARD-DECLARATION STUB.
 *
 * The video module is not yet implemented (see ../plan.md). This stub exists so
 * the aiui `video-player` surface has an owning service contract to grow into.
 *
 * Runtime contract for module aiui surfaces (see AIUIComposerService JSDoc):
 *   mountSurface(surfaceId, container, props) → cleanupFn
 *
 * Until the real timeline engine ships, mountSurface renders a placeholder and
 * returns a no-op cleanup. The service is intentionally NOT wired into a video
 * module index.js yet, so the composer surfaces a clear "module not loaded"
 * error until the module is implemented and registered.
 */
export class VideoCompositionService {
    constructor(eventBus) {
        this.eventBus = eventBus;
    }

    init() {
        // TODO: initialize composition state (see ../plan.md §9).
    }

    /**
     * @param {string} surfaceId
     * @param {HTMLElement} container
     * @param {Object} [props] - { src, poster, muted, autoplay }
     * @returns {Function} cleanup (no-op until implemented)
     */
    mountSurface(surfaceId, container, props = {}) {
        if (surfaceId !== 'video-player') {
            throw new Error(`VideoCompositionService.mountSurface: unknown surface "${surfaceId}"`);
        }
        const doc = container.ownerDocument || globalThis.document;
        const player = doc.createElement('video');
        player.className = 'video-player';
        player.setAttribute('controls', '');
        if (props.poster) player.setAttribute('poster', props.poster);
        if (props.src) player.setAttribute('src', props.src);
        if (props.muted === 'true' || props.muted === true) player.muted = true;
        if (props.autoplay === 'true' || props.autoplay === true) player.setAttribute('autoplay', '');
        // TODO: wire real playback engine once the video module is implemented.
        container.replaceChildren(player);

        // No-op cleanup until the timeline engine owns real resources.
        return () => {
            /* TODO: dispose timeline + media resources. */
            container.replaceChildren();
        };
    }
}
