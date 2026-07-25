import { spec, specShell, specFoot, specContainer } from './_shared.js';

/**
 * quote — pull-quote with attribution. Optional background image under scrim.
 *
 * Config: `{ text, name, role?, image?, center=true }`
 *
 * Emits a SPEC TREE (Phase 2.0).
 */
export function createQuoteSlide(config = {}) {
    const textChildren = [
        spec('span', { className: 'quote-mark', text: '"' })
    ];
    if (config.text) {
        textChildren.push(spec('span', { className: 'quote-body', text: String(config.text) }));
    }
    const text = spec('blockquote', { className: 'quote-text', children: textChildren });

    const attribChildren = [];
    if (config.name) attribChildren.push(spec('p', { className: 'quote-name', text: String(config.name) }));
    if (config.role) attribChildren.push(spec('p', { className: 'quote-role', text: String(config.role) }));
    const attrib = spec('div', { className: 'quote-attribution', children: attribChildren });

    return specShell('quote', { center: true }, [specContainer([text, attrib])]);
}
