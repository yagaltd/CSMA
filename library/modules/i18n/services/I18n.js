/**
 * I18n - Internationalization system (~1.5KB)
 * Simple translation with interpolation and pluralization
 */
export class I18n {
    constructor(eventBus, defaultLocale = 'en') {
        this.eventBus = eventBus;
        this.currentLocale = defaultLocale;
        this.translations = {};
        this.fallbackLocale = 'en';
    }

    /**
     * Load translations for a locale
     */
    async loadLocale(locale, translations) {
        this.translations[locale] = translations;

        if (locale === this.currentLocale) {
            this.eventBus.publish('LOCALE_LOADED', { locale });
        }
    }

    /**
     * Set current locale
     */
    setLocale(locale) {
        if (!this.translations[locale]) {
            console.warn(`Translations for "${locale}" not loaded`);
            return;
        }

        const oldLocale = this.currentLocale;
        this.currentLocale = locale;

        // Save to localStorage
        localStorage.setItem('locale', locale);

        // Update HTML lang attribute
        document.documentElement.lang = locale;

        // Publish event
        this.eventBus.publish('LANGUAGE_CHANGED', {
            from: oldLocale,
            to: locale
        });
    }

    /**
     * Get current locale
     */
    get locale() {
        return this.currentLocale;
    }

    /**
     * Translate a key
     */
    t(key, params = {}) {
        const translation = this.getTranslation(key);
        return this.interpolate(translation, params);
    }

    /**
     * Get translation by key
     */
    getTranslation(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLocale];

        // Try current locale
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                value = undefined;
                break;
            }
        }

        // Fallback to default locale
        if (value === undefined) {
            value = this.translations[this.fallbackLocale];
            for (const k of keys) {
                if (value && typeof value === 'object') {
                    value = value[k];
                } else {
                    value = undefined;
                    break;
                }
            }
        }

        // Return key if not found
        return value !== undefined ? value : key;
    }

    /**
     * Interpolate parameters into translation
     */
    interpolate(text, params) {
        if (typeof text !== 'string') return text;

        return text.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }

    /**
     * Pluralize based on count
     */
    plural(key, count, params = {}) {
        const translation = this.getTranslation(key);

        if (typeof translation === 'object') {
            let pluralKey;

            if (count === 0 && translation.zero) {
                pluralKey = 'zero';
            } else if (count === 1) {
                pluralKey = 'one';
            } else {
                pluralKey = 'other';
            }

            const text = translation[pluralKey] || translation.other || key;
            return this.interpolate(text, { ...params, count });
        }

        return this.interpolate(translation, { ...params, count });
    }

    /**
     * Get all available locales
     */
    get locales() {
        return Object.keys(this.translations);
    }

    /**
     * Check if locale exists
     */
    hasLocale(locale) {
        return this.locales.includes(locale);
    }
}

/**
 * Create i18n instance
 */
export function createI18n(eventBus, defaultLocale) {
    return new I18n(eventBus, defaultLocale);
}
