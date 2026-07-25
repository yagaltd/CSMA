import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * agenda — numbered table-of-contents. Items can be strings or objects with
 * `{title, hint}` for time estimates.
 *
 * Config: `{ kicker?, title?, items: (string|{title,hint})[] }`
 */
export function createAgendaSlide(config = {}) {
    const slide = createSlideShell('agenda', { center: true });

    const header = el('div', { className: 'agenda-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const list = el('ol', { className: 'agenda-list' });
    const items = Array.isArray(config.items) ? config.items : [];
    items.forEach((item) => {
        const li = el('li', { className: 'agenda-item' });
        const title = typeof item === 'string' ? item : (item?.title || '');
        li.appendChild(el('span', { className: 'agenda-title', text: String(title) }));
        if (item && typeof item === 'object' && item.hint) {
            li.appendChild(el('span', { className: 'agenda-hint', text: String(item.hint) }));
        }
        list.appendChild(li);
    });

    slide.appendChild(container([header, list]));
    return slide;
}
