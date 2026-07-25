import { el } from './_shared.js';

/**
 * browser-frame — app/product screenshot in browser chrome wrapper.
 * Embedded in `split` media or used standalone.
 *
 * Config: `{ url?, screenshot? }` — `screenshot` is a path set via data-attr
 * (CSS handles background-image). No inline styles, no <img src> with
 * user-provided path (defense in depth).
 */
export function createBrowserFrameSlide(config = {}) {
    const frame = el('div', { className: 'browser-frame' });

    const bar = el('div', { className: 'browser-bar', children: [
        el('span', { className: 'browser-dot browser-dot--red' }),
        el('span', { className: 'browser-dot browser-dot--yellow' }),
        el('span', { className: 'browser-dot browser-dot--green' }),
        el('span', { className: 'browser-url', text: String(config.url || '') })
    ] });
    frame.appendChild(bar);

    const body = el('div', { className: 'browser-body' });
    if (config.screenshot) body.dataset.screenshot = String(config.screenshot);
    frame.appendChild(body);

    return frame;
}
