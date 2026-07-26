import { spec } from './_shared.js';

/**
 * browser-frame — app/product screenshot in browser chrome wrapper.
 * Embedded in `split` media or used standalone.
 *
 * Config: `{ url?, screenshot? }` — `screenshot` is a path set via data-attr
 * (CSS handles background-image). No inline styles, no <img src> with
 * user-provided path (defense in depth).
 *
 * Emits a SPEC TREE (Phase 2.1).
 */
export function createBrowserFrameSlide(config = {}) {
    const bar = spec('div', { className: 'browser-bar', children: [
        spec('span', { className: 'browser-dot browser-dot--red' }),
        spec('span', { className: 'browser-dot browser-dot--yellow' }),
        spec('span', { className: 'browser-dot browser-dot--green' }),
        spec('span', { className: 'browser-url', text: String(config.url || '') })
    ] });

    const bodyOpts = { className: 'browser-body' };
    if (config.screenshot) {
        bodyOpts.dataset = { screenshot: String(config.screenshot) };
    }
    const body = spec('div', bodyOpts);

    return spec('div', { className: 'browser-frame', children: [bar, body] });
}
