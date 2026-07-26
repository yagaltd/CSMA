import { spec, specShell, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * accordion — expand/collapse panels using native <details> for accessibility.
 * Used for FAQs and feature detail. Don't use for primary content — audience
 * can't click along during a presented deck.
 *
 * Config: `{ kicker?, title?, items: [{title, body}] }`
 *
 * Emits a SPEC TREE (Phase 2.1). deck.js mounts it via the aiui composer's
 * `mountTree()`.
 */
export function createAccordionSlide(config = {}) {
    const header = spec('div', { className: 'accordion-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const items = Array.isArray(config.items) ? config.items : [];
    const list = spec('div', {
        className: 'accordion-list',
        children: items.map((item) => {
            const detailsChildren = [
                spec('summary', { className: 'accordion-summary', text: String(item.title || '') })
            ];
            if (item.body) {
                detailsChildren.push(spec('p', { className: 'accordion-body', text: String(item.body) }));
            }
            return spec('details', { className: 'accordion-item', children: detailsChildren });
        })
    });

    return specShell('accordion', { center: true }, [specContainer([header, list])]);
}
