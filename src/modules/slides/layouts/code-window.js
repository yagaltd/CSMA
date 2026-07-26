import { spec } from './_shared.js';

/**
 * code-window — code block with macOS chrome + optional line highlights.
 * Embedded in `split` media or used standalone (rare).
 *
 * Config: `{ title?, highlight: number[]?, code: string }`
 *
 * Emits a SPEC TREE (Phase 2.1).
 *
 * Security: code is rendered as textContent of line spans inside a `<pre>`
 * — no syntax highlighter that touches innerHTML, no eval. Lines highlighted
 * by row index via data-line attributes (CSS handles the striping).
 */
export function createCodeWindowSlide(config = {}) {
    const chromeChildren = [
        spec('span', { className: 'code-dot code-dot--red' }),
        spec('span', { className: 'code-dot code-dot--yellow' }),
        spec('span', { className: 'code-dot code-dot--green' })
    ];
    if (config.title) {
        chromeChildren.push(spec('span', { className: 'code-title', text: String(config.title) }));
    }

    const preChildren = [];
    if (typeof config.code === 'string') {
        const lines = config.code.split('\n');
        const highlight = Array.isArray(config.highlight) ? new Set(config.highlight) : new Set();
        for (let i = 0; i < lines.length; i++) {
            const lineNo = i + 1;
            const lineDataset = { line: String(lineNo) };
            if (highlight.has(lineNo)) lineDataset.highlight = 'true';
            preChildren.push(spec('span', {
                className: 'code-line',
                text: lines[i] || ' ',
                dataset: lineDataset
            }));
            // <br> is not in SAFE_TAGS — use DOM Node passthrough (mountTree
            // accepts raw Nodes in children arrays alongside spec nodes).
            if (typeof document !== 'undefined') {
                preChildren.push(document.createElement('br'));
            }
        }
    } else {
        preChildren.push(spec('code'));
    }

    return spec('div', { className: 'code-window', children: [
        spec('div', { className: 'code-chrome', children: chromeChildren }),
        spec('pre', { className: 'code-body', children: preChildren })
    ] });
}
