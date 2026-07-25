import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';

/**
 * team — people grid. Each card has name, role, optional image (via data-img,
 * rendered by CSS) or initials fallback.
 *
 * Config: `{ kicker?, title?, people: [{name, role, img?}] }`
 */
export function createTeamSlide(config = {}) {
    const slide = createSlideShell('team', { center: true });

    const header = el('div', { className: 'team-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const grid = el('div', { className: 'team-grid' });
    const people = Array.isArray(config.people) ? config.people : [];
    people.forEach((person) => grid.appendChild(buildPerson(person)));

    slide.appendChild(container([header, grid]));
    return slide;
}

function buildPerson(person = {}) {
    const card = el('div', { className: 'team-card' });
    if (person.img) card.dataset.image = String(person.img);

    const avatar = el('div', { className: 'team-avatar' });
    // Initials fallback — derived from name, never user-provided markup
    const initials = String(person.name || '')
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();
    avatar.textContent = initials;
    card.appendChild(avatar);

    if (person.name) card.appendChild(el('p', { className: 'team-name', text: String(person.name) }));
    if (person.role) card.appendChild(el('p', { className: 'team-role', text: String(person.role) }));
    return card;
}
