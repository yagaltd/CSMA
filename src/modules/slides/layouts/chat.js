import { el, createSlideShell, createKicker, createHeading, container } from './_shared.js';
import { createBuildElement } from '../engine/build.js';

/**
 * chat — message exchange. Each message is wrapped in a Build element so each
 * click reveals one message. Use only for products with a genuine chat/AI
 * interface.
 *
 * Config: `{ kicker?, title?, name?, messages: [{from:'user'|'ai', text}] }`
 *
 * The deck wires up build registration once the slide is attached. Here we
 * pre-stamp each message with data-build-step; deck's mountBuilds() will
 * call service.registerMax on each.
 */
export function createChatSlide(config = {}) {
    const slide = createSlideShell('chat', { center: false });
    if (config.name) slide.dataset.botName = String(config.name);

    const header = el('div', { className: 'chat-header', children: [
        createKicker(config.kicker),
        createHeading(config.title)
    ].filter(Boolean) });

    const thread = el('div', { className: 'chat-thread' });
    const messages = Array.isArray(config.messages) ? config.messages : [];
    messages.forEach((msg, i) => {
        const step = i + 1;
        const bubble = el('div', {
            className: 'chat-bubble',
            dataset: { from: String(msg.from || 'user') }
        });
        if (msg.text) bubble.appendChild(el('p', { className: 'chat-text', text: String(msg.text) }));
        // Wrap each message in a Build element so the deck can reveal on click.
        const build = createBuildElement({ at: step, children: [bubble] });
        thread.appendChild(build);
    });

    slide.appendChild(container([header, thread]));
    return slide;
}
