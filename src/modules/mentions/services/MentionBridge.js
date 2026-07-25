/**
 * MentionBridge — subscribes to MENTION_DETECTED, calls AIService for @ai mentions.
 */
export class MentionBridge {
    /**
     * @param {import('../../../runtime/EventBus.js').EventBus} eventBus
     */
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.aiService = null;
        this._unsubscribers = [];
        this.initialized = false;
    }

    /**
     * Initialize the bridge with an optional AI service.
     * @param {{ aiService?: object }} [opts]
     */
    init({ aiService } = {}) {
        if (this.initialized) this.destroy();
        this.initialized = true;
        this.aiService = aiService || null;

        if (this.aiService) {
            const unsub = this.eventBus.subscribe(
                'MENTION_DETECTED',
                this._handleMentions.bind(this)
            );
            this._unsubscribers.push(unsub);
        }
    }

    /**
     * Tear down subscriptions and reset state.
     */
    destroy() {
        this._unsubscribers.forEach(fn => {
            try { fn(); } catch { /* cleanup failure is non-fatal */ }
        });
        this._unsubscribers = [];
        this.aiService = null;
        this.initialized = false;
    }

    /**
     * @param {object} ev — { mentions, body, source, sourceId, context }
     */
    async _handleMentions(ev) {
        if (!this.aiService) return;

        const aiMentions = (ev.mentions || []).filter(m => m.type === 'ai');
        if (aiMentions.length === 0) return;

        for (const mention of aiMentions) {
            try {
                const response = await this.aiService.generateText({
                    system: this._buildSystemPrompt(ev.context),
                    prompt: ev.body,
                    stream: false
                });

                this.eventBus.publish('MENTION_AI_TASK_COMPLETED', {
                    source: ev.source,
                    sourceId: ev.sourceId,
                    mention,
                    response: typeof response === 'string'
                        ? response
                        : (response?.text || ''),
                    timestamp: Date.now()
                });
            } catch (err) {
                this.eventBus.publish('MENTION_AI_TASK_COMPLETED', {
                    source: ev.source,
                    sourceId: ev.sourceId,
                    mention,
                    error: err?.message || 'AI generation failed',
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * @param {object} [context]
     * @returns {string}
     */
    _buildSystemPrompt(context = {}) {
        const parts = ['You are helping a user edit a document.'];
        if (context.docType) parts.push(`Document type: ${context.docType}`);
        if (context.surroundingContent) {
            parts.push(
                `Content around the comment:\n${context.surroundingContent}`
            );
        }
        parts.push('Reply with what should change. Be concise.');
        return parts.join('\n');
    }
}
