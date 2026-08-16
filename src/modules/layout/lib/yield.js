/**
 * yieldToMain — cooperative main-thread yielding for long synchronous chunks.
 *
 * Heuristic (modern-web-guidance INP): tasks under ~50ms run synchronously;
 * 50–250ms should be sliced with yields; over ~250ms belongs in a Web Worker.
 * Use inside loops that process large arrays or batch CPU work that cannot go
 * through RenderScheduler (which coalesces DOM renders, not computation).
 *
 * Uses scheduler.yield() when available (continuation jumps the task queue);
 * falls back to a macrotask setTimeout(0) otherwise.
 *
 *   for (let i = 0; i < items.length; i++) {
 *     process(items[i]);
 *     if (i % 50 === 0) await yieldToMain();
 *   }
 *
 * @returns {Promise<void>}
 */
export function yieldToMain() {
    if (typeof scheduler !== 'undefined' && typeof scheduler.yield === 'function') {
        return scheduler.yield();
    }
    return new Promise((resolve) => setTimeout(resolve, 0));
}
