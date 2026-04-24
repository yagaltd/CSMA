import { object, string, number, optional, enums, size } from '../../../runtime/validation/index.js';

const TITLE_MAX = 120;
const TEXT_MAX = 4000;
const URL_MAX = 2048;

const shareText = size(string(), 0, TEXT_MAX);
const shareTitle = size(string(), 0, TITLE_MAX);
const shareUrl = size(string(), 1, URL_MAX);

export const ShareContracts = {
    INTENT_SHARE_REQUEST: {
        version: 1,
        type: 'intent',
        owner: 'share-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Request to share content via browser share or clipboard',
        schema: object({
            title: optional(shareTitle),
            text: optional(shareText),
            url: optional(shareUrl),
            source: optional(string()),
            timestamp: number()
        })
    },

    SHARE_COMPLETED: {
        version: 1,
        type: 'event',
        owner: 'share-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when content is shared or copied successfully',
        schema: object({
            title: optional(shareTitle),
            text: optional(shareText),
            url: optional(shareUrl),
            transport: enums(['web-share', 'clipboard']),
            source: optional(string()),
            timestamp: number()
        })
    },

    SHARE_FAILED: {
        version: 1,
        type: 'event',
        owner: 'share-module',
        lifecycle: 'active',
        stability: 'stable',
        compliance: 'public',
        description: 'Published when sharing fails',
        schema: object({
            title: optional(shareTitle),
            text: optional(shareText),
            url: optional(shareUrl),
            reason: enums([
                'invalid-payload',
                'unsafe-url',
                'empty-content',
                'web-share-unavailable',
                'web-share-denied',
                'web-share-failed',
                'clipboard-unavailable',
                'clipboard-failed'
            ]),
            message: size(string(), 1, 400),
            source: optional(string()),
            timestamp: number()
        })
    }
};

export const SHARE_LIMITS = {
    TITLE_MAX,
    TEXT_MAX,
    URL_MAX
};
