import { spec, specKicker, specHeading, specContainer } from './_shared.js';

/**
 * chat — message exchange. Each message is wrapped in a Build element so each
 * click reveals one message. Use only for products with a genuine chat/AI
 * interface.
 *
 * Config: `{ kicker?, title?, name?, messages: [{from:'user'|'ai', text}] }`
 *
 * Emits a SPEC TREE (Phase 2.1). Each message is pre-stamped with
 * `data-build-step`; deck.js's mountBuilds() reads `[data-build-step]` and
 * calls service.registerMax for each. Initial `data-visible` is `'false'`
 * for every step (matches the legacy createBuildElement with currentClicks=0).
 */
export function createChatSlide(config = {}) {
    const dataset = { layout: 'chat' };
    if (config.name) dataset.botName = String(config.name);

    const header = spec('div', { className: 'chat-header', children: [
        specKicker(config.kicker),
        specHeading(config.title)
    ] });

    const messages = Array.isArray(config.messages) ? config.messages : [];
    const threadChildren = messages.map((msg, i) => {
        const step = i + 1;
        const bubbleChildren = [];
        if (msg.text) bubbleChildren.push(spec('p', { className: 'chat-text', text: String(msg.text) }));
        const bubble = spec('div', {
            className: 'chat-bubble',
            dataset: { from: String(msg.from || 'user') },
            children: bubbleChildren
        });
        // Wrap each message in a build reveal — dataset.buildStep / dataset.visible
        // are read by deck.mountBuilds() at attach time.
        return spec('div', {
            className: 'build',
            dataset: { buildStep: String(step), visible: 'false' },
            children: [bubble]
        });
    });
    const thread = spec('div', { className: 'chat-thread', children: threadChildren });

    const inner = specContainer([header, thread]);
    return spec('div', { className: 'slide', dataset, children: [inner] });
}
