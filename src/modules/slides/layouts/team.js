import { spec, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * team — people grid. Each card has name, role, optional image (via data-img,
 * rendered by CSS) or initials fallback.
 *
 * Config: `{ kicker?, title?, people: [{name, role, img?}] }`
 *
 * Emits a SPEC TREE (Phase 2.1).
 */
export function createTeamSlide(config = {}) {
    const header = spec('div', { className: 'team-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const people = Array.isArray(config.people) ? config.people : [];
    const grid = spec('div', {
        className: 'team-grid',
        children: people.map((person) => buildPersonSpec(person))
    });

    const inner = specContainer([header, grid]);
    return spec('div', { className: 'slide center', dataset: { layout: 'team' }, children: [inner] });
}

/**
 * Build a single team-card spec node. Initials derived from name (never
 * user-provided markup). Spec equivalent of the legacy buildPerson().
 */
function buildPersonSpec(person = {}) {
    const cardOpts = { className: 'team-card' };
    if (person.img) {
        cardOpts.dataset = { image: String(person.img) };
    }

    const initials = String(person.name || '')
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const children = [spec('div', { className: 'team-avatar', text: initials })];
    if (person.name) children.push(spec('p', { className: 'team-name', text: String(person.name) }));
    if (person.role) children.push(spec('p', { className: 'team-role', text: String(person.role) }));

    return spec('div', { ...cardOpts, children });
}
