/**
 * CSMA page contracts.
 * Extracted verbatim from runtime/Contracts.js (Phase 6.3); merged by the
 * Contracts facade — see src/runtime/Contracts.js.
 */
import { object, string, optional, size, array } from '../validation/index.js';

export const PageContracts = {
    // Page metadata changed (for MetaManager)
    PAGE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'meta-manager',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'SEO metadata update for current page',

        schema: object({
            title: size(string(), 1, 60),  // SEO limit
            description: size(string(), 1, 160),  // SEO limit
            image: optional(string()),
            locale: optional(size(string(), 2, 35)),
            canonical: optional(string()),
            alternates: optional(array(object({
                locale: size(string(), 1, 35),
                href: size(string(), 1, 2048)
            }))),
            robots: optional(string())
        })
    },
};
