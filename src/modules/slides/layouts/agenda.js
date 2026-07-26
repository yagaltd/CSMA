import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * agenda — numbered table-of-contents. Items can be strings or objects with
 * `{title, hint}` for time estimates.
 *
 * Config: `{ kicker?, title?, items: (string|{title,hint})[] }`
 *
 * Emits a SPEC TREE (Phase 2.1). deck.js mounts it via the aiui composer's
 * `mountTree()`. To embed any aiui surface inside this layout, drop a
 * `component('comments-thread', { threadId })` (or similar) node anywhere in
 * the tree.
 */
export function createAgendaSlide(config = {}) {
    const header = spec('div', { className: 'agenda-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const items = Array.isArray(config.items) ? config.items : [];
    const list = spec('ol', {
        className: 'agenda-list',
        children: items.map((item) => {
            const title = typeof item === 'string' ? item : (item?.title || '');
            const liChildren = [spec('span', { className: 'agenda-title', text: String(title) })];
            if (item && typeof item === 'object' && item.hint) {
                liChildren.push(spec('span', { className: 'agenda-hint', text: String(item.hint) }));
            }
            return spec('li', { className: 'agenda-item', children: liChildren });
        })
    });

    return specShell('agenda', { center: true }, [specContainer([header, list])]);
}
