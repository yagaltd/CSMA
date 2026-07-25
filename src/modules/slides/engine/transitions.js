/**
 * transitions.js — CSS-first slide enter/exit orchestrator.
 *
 * animateSlideTransition swaps the slide-stage's content while toggling
 * data-transition on the stage. CSS keyframes (see slides.css §transitions)
 * drive the visual animation. We only manage the timing/sequencing.
 *
 * Respects prefers-reduced-motion — the CSS disables motion; we still swap
 * content synchronously so the function resolves immediately.
 */

const TRANSITION_DURATION_MS = 420; // matches --motion-duration-slow token

/**
 * Animate a slide transition.
 *
 * @param {HTMLElement} stage — the `.slide-stage` element
 * @param {'next'|'prev'} direction — which way the new slide is coming from
 * @param {() => void} swapFn — function that swaps the slide DOM content
 * @returns {Promise<void>} resolves when enter animation completes
 */
export function animateSlideTransition(stage, direction, swapFn) {
    if (!stage || typeof swapFn !== 'function') return Promise.resolve();

    const doc = stage.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const reducedMotion = doc && winMatch(doc) ? true : false;

    if (reducedMotion) {
        swapFn();
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const dir = direction === 'prev' ? 'right' : 'left';
        stage.dataset.transition = 'exit ' + dir;

        const exitDone = () => {
            swapFn();
            stage.dataset.transition = 'enter ' + dir;

            // Wait for enter animation to finish, then clean up.
            const enterDone = () => {
                stage.removeEventListener('animationend', enterDone);
                delete stage.dataset.transition;
                resolve();
            };
            stage.addEventListener('animationend', enterDone);
            // Safety timeout in case animationend doesn't fire (hidden tab etc.)
            setTimeout(() => {
                stage.removeEventListener('animationend', enterDone);
                delete stage.dataset.transition;
                resolve();
            }, TRANSITION_DURATION_MS + 80);
        };

        // For exit, we wait a short tick then swap. animationend on exit isn't
        // reliable across browsers when the same property transitions twice.
        setTimeout(exitDone, 60);
    });
}

function winMatch(doc) {
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : null);
    if (!win || !win.matchMedia) return false;
    try {
        return win.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}
