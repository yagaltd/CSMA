import { spec, specShell, specKicker, specHeading, specFoot, specContainer } from './_shared.js';

/**
 * table — data table with columns/rows and optional highlight column.
 *
 * Config: `{ kicker?, title?, columns: string[], rows: string[][], highlightCol?, caption?, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.1). Byte-identical DOM to the prior el() version.
 */
export function createTableSlide(config = {}) {
    const cols = Array.isArray(config.columns) ? config.columns : [];
    const rows = Array.isArray(config.rows) ? config.rows : [];
    const highlightCol = Number.isFinite(config.highlightCol) ? config.highlightCol : -1;

    const header = spec('div', { className: 'table-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const thCells = cols.map((col, i) => spec('th', {
        text: String(col || ''),
        dataset: i === highlightCol ? { highlight: 'true' } : {}
    }));
    const thead = spec('thead', { children: [spec('tr', { children: thCells })] });

    const bodyRows = rows.map((row) => {
        const cells = Array.isArray(row) ? row : [];
        const tds = cells.map((cell, i) => spec('td', {
            text: String(cell ?? ''),
            dataset: i === highlightCol ? { highlight: 'true' } : {}
        }));
        return spec('tr', { children: tds });
    });
    const tbody = spec('tbody', { children: bodyRows });

    const table = spec('table', { className: 'data-table', children: [thead, tbody] });

    const children = [header, table];
    if (config.caption) children.push(specFoot(config.caption));

    return specShell('table', { center: true }, [specContainer(children)]);
}
