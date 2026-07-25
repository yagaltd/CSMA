import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * comparison — us-vs-them feature matrix. One column highlighted in accent.
 * Each cell value can be boolean (checkmark/cross) or string.
 *
 * Config: `{ kicker?, title?, cols: string[], rows: [{label, values[]}], highlight?, center=true }`
 */
export function createComparisonSlide(config = {}) {
    const slide = createSlideShell('comparison', { center: true });

    const header = el('div', { className: 'comparison-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const table = el('table', { className: 'comparison-table' });
    const cols = Array.isArray(config.cols) ? config.cols : [];
    const rows = Array.isArray(config.rows) ? config.rows : [];
    const highlight = Number.isFinite(config.highlight) ? config.highlight : -1;

    const thead = el('thead');
    const tr = el('tr');
    cols.forEach((col, i) => {
        const th = el('th', { text: String(col || '') });
        if (i === highlight) th.dataset.highlight = 'true';
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const row of rows) {
        const tr2 = el('tr');
        tr2.appendChild(el('th', { className: 'row-label', text: String(row.label || '') }));
        const values = Array.isArray(row.values) ? row.values : [];
        values.forEach((val, i) => {
            const td = el('td');
            // Column highlight offset by 1 because first th is the label
            if (i + 1 === highlight) td.dataset.highlight = 'true';
            if (val === true) td.dataset.bool = 'true';
            else if (val === false) td.dataset.bool = 'false';
            else td.textContent = String(val ?? '');
            tr2.appendChild(td);
        });
        tbody.appendChild(tr2);
    }
    table.appendChild(tbody);

    slide.appendChild(container([header, table]));
    return slide;
}
