import { el, createSlideShell, createKicker, createHeading, createFoot, container } from './_shared.js';

/**
 * table — data table with columns/rows and optional highlight column.
 *
 * Config: `{ kicker?, title?, columns: string[], rows: string[][], highlightCol?, caption?, center=true }`
 */
export function createTableSlide(config = {}) {
    const slide = createSlideShell('table', { center: true });

    const header = el('div', { className: 'table-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const table = el('table', { className: 'data-table' });
    const cols = Array.isArray(config.columns) ? config.columns : [];
    const rows = Array.isArray(config.rows) ? config.rows : [];
    const highlightCol = Number.isFinite(config.highlightCol) ? config.highlightCol : -1;

    const thead = el('thead');
    const tr = el('tr');
    cols.forEach((col, i) => {
        const th = el('th', { text: String(col || '') });
        if (i === highlightCol) th.dataset.highlight = 'true';
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = el('tbody');
    for (const row of rows) {
        const tr2 = el('tr');
        const cells = Array.isArray(row) ? row : [];
        cells.forEach((cell, i) => {
            const td = el('td', { text: String(cell ?? '') });
            if (i === highlightCol) td.dataset.highlight = 'true';
            tr2.appendChild(td);
        });
        tbody.appendChild(tr2);
    }
    table.appendChild(tbody);

    const children = [header, table];
    if (config.caption) children.push(createFoot(config.caption));
    slide.appendChild(container(children));
    return slide;
}
