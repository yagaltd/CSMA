/**
 * MentionResolver — dispatches mention types to registered resolvers.
 */
export class MentionResolver {
    /**
     * @param {Record<string, function>} [resolvers={}]
     */
    constructor(resolvers = {}) {
        this.resolvers = resolvers;
    }

    /**
     * Resolve a mention through a registered resolver.
     * @param {{ type: string, id: string|null }} mention
     * @param {object} [context]
     * @returns {{ target: string, payload: object } | null}
     */
    resolve(mention, context = {}) {
        const resolver = this.resolvers[mention.type];
        if (!resolver) return null;
        try {
            return resolver(mention, context);
        } catch {
            return null;
        }
    }

    /**
     * Register a resolver for a mention type.
     * @param {string} type — e.g. 'ai', 'user', 'group'
     * @param {function} fn — (mention, context) => { target, payload } | null
     */
    register(type, fn) {
        this.resolvers[type] = fn;
    }

    /**
     * Unregister a resolver.
     * @param {string} type
     */
    unregister(type) {
        delete this.resolvers[type];
    }
}
