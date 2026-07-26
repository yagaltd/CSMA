import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * comparison — us-vs-them feature matrix. One column highlighted in accent.
 * Each cell value can be boolean (checkmark/cross) or string.
 *
 * Config: `{ kicker?, title?, cols: string[], rows: [{label, values[]}], highlight?, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.1). Byte-identical DOM to the prior el() version.
 */
export function createComparisonSlide(config = {}) {
    const cols = Array.isArray(config.cols) ? config.cols : [];
    const rows = Array.isArray(config.rows) ? config.rows : [];
    const highlight = Number.isFinite(config.highlight) ? config.highlight : -1;

    const header = spec('div', { className: 'comparison-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const thCells = cols.map((col, i) => spec('th', {
        text: String(col || ''),
        dataset: i === highlight ? { highlight: 'true' } : {}
    }));
    const thead = spec('thead', { children: [spec('tr', { children: thCells })] });

    const bodyRows = rows.map((row) => {
        const labelCell = spec('th', { className: 'row-label', text: String(row.label || '') });
        const values = Array.isArray(row.values) ? row.values : [];
        const valueCells = values.map((val, i) => {
            const dataset = {};
            if (i + 1 === highlight) dataset.highlight = 'true';
            if (val === true) dataset.bool = 'true';
            else if (val === false) dataset.bool = 'false';
            const opts = { dataset };
            if (val !== true && val !== false) opts.text = String(val ?? '');
            return spec('td', opts);
        });
        return spec('tr', { children: [labelCell, ...valueCells] });
    });
    const tbody = spec('tbody', { children: bodyRows });

    const table = spec('table', { className: 'comparison-table', children: [thead, tbody] });

    return specShell('comparison', { center: true }, [specContainer([header, table])]);
}
