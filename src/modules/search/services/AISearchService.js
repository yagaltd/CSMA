import { EnhancedSearchService } from './EnhancedSearchService.js';

export class AISearchService extends EnhancedSearchService {
    constructor(eventBus, options = {}) {
        super(eventBus, {
            tier: 'ai',
            variant: options.variant || 'full',
            context: {
                documents: 5,
                charLimit: 4000,
                ...(options.context || {})
            },
            ...options
        });

        this.contextOptions = {
            documents: 5,
            charLimit: 4000,
            ...(options.context || {})
        };
    }

    init(options = {}) {
        super.init(options);
        this.contextOptions = {
            ...this.contextOptions,
            ...(options.context || {})
        };

        if (this.eventBus) {
            this.subscriptions.push(
                this.eventBus.subscribe('AI_CONTEXT_REQUESTED', (payload) => this.#handleContextRequest(payload))
            );
        }

        return this;
    }

    async #handleContextRequest(payload = {}) {
        if (!payload.query) {
            return null;
        }

        try {
            const ids = await super.executeQuery(payload.query, {
                options: {
                    limit: this.contextOptions.documents
                }
            });
            const context = this.#buildContext(ids);
            this.eventBus?.publish('AI_CONTEXT_RETRIEVED', {
                query: payload.query,
                context,
                tokensSaved: Math.max(1, Math.round(context.length / 4)),
                timestamp: Date.now()
            });
            return context;
        } catch (error) {
            this.eventBus?.publish('AI_CONTEXT_FAILED', {
                query: payload.query,
                error: error?.message || String(error),
                timestamp: Date.now()
            });
            return null;
        }
    }

    #buildContext(ids) {
        const docs = ids
            .map((id) => this.documents.get(id))
            .filter(Boolean)
            .slice(0, this.contextOptions.documents);

        const chunks = docs.map((doc) => this.#formatDocument(doc));
        const rawContext = chunks.join('\n---\n');
        return rawContext.slice(0, this.contextOptions.charLimit);
    }

    #formatDocument(doc) {
        const title = doc.title || doc.name || doc.id;
        const summary = doc.content || doc.body || doc.text || '';
        const tags = Array.isArray(doc.tags) ? doc.tags.join(', ') : doc.tags || '';
        return [`Title: ${title}`, tags ? `Tags: ${tags}` : '', summary ? `Content: ${summary}` : '']
            .filter(Boolean)
            .join('\n');
    }
}
