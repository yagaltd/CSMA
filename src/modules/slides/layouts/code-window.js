import { el } from './_shared.js';

/**
 * code-window — code block with macOS chrome + optional line highlights.
 * Embedded in `split` media or used standalone (rare).
 *
 * Config: `{ title?, highlight: number[]?, code: string }`
 *
 * Security: code is rendered as textContent of a single <pre><code> block —
 * no syntax highlighter that touches innerHTML, no eval. Lines highlighted by
 * row index via data-line attributes (CSS handles the striping).
 */
export function createCodeWindowSlide(config = {}) {
    const wrap = el('div', { className: 'code-window' });

    const chrome = el('div', { className: 'code-chrome', children: [
        el('span', { className: 'code-dot code-dot--red' }),
        el('span', { className: 'code-dot code-dot--yellow' }),
        el('span', { className: 'code-dot code-dot--green' }),
        config.title ? el('span', { className: 'code-title', text: String(config.title) }) : null
    ].filter(Boolean) });
    wrap.appendChild(chrome);

    const pre = el('pre', { className: 'code-body' });
    const code = el('code');
    code.textContent = typeof config.code === 'string' ? config.code : '';
    pre.appendChild(code);
    wrap.appendChild(pre);

    // Highlight rows via data-line on each line wrapper. We split the source
    // into lines so the CSS can stripe/highlight without innerHTML.
    if (typeof config.code === 'string') {
        pre.removeChild(code);
        const lines = config.code.split('\n');
        const highlight = Array.isArray(config.highlight) ? new Set(config.highlight) : new Set();
        for (let i = 0; i < lines.length; i++) {
            const lineNo = i + 1;
            const line = el('span', {
                className: 'code-line',
                text: lines[i] || ' '
            });
            line.dataset.line = String(lineNo);
            if (highlight.has(lineNo)) line.dataset.highlight = 'true';
            pre.appendChild(line);
            pre.appendChild(el('br'));
        }
    }

    return wrap;
}
