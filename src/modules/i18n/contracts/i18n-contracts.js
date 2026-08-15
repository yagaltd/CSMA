import { object, string, enums } from '../../../runtime/validation/index.js';

/**
 * I18n module — EventBus contracts.
 *
 * Direction fields are constrained to 'ltr' | 'rtl' — the same values
 * `getLocaleDirection()` resolves and assigns to document.documentElement.dir.
 */

const DIRECTION = enums(['ltr', 'rtl']);

export const I18nContracts = {
    LOCALE_LOADED: {
        version: 1,
        type: 'event',
        owner: 'i18n-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when translations for the current locale are loaded',
        schema: object({
            locale: string()
        })
    },

    LANGUAGE_CHANGED: {
        version: 1,
        type: 'event',
        owner: 'i18n-module',
        lifecycle: 'active',
        stability: 'stable',
        description: 'Published when the active locale changes, including direction deltas',
        schema: object({
            from: string(),
            to: string(),
            fromDirection: DIRECTION,
            toDirection: DIRECTION,
            direction: DIRECTION
        })
    }
};
