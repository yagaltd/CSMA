/**
 * MetaManager - Homemade SEO/Meta tag manager
 * Handles page metadata, locale, and SEO tags
 */
import { LifecycleScope } from './LifecycleScope.js';

export class MetaManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.translations = {};
        this.lifecycle = new LifecycleScope('MetaManager');
        this.destroyed = false;
        this.init();
    }

    init() {
        if (!this.destroyed && this.lifecycle.cleanups.length > 0) {
            return;
        }

        if (this.destroyed) {
            this.lifecycle = new LifecycleScope('MetaManager');
            this.destroyed = false;
        }

        this.lifecycle.subscribe(this.eventBus, 'PAGE_CHANGED', this.updateMeta.bind(this));
    }

    updateMeta({ title, description, image, locale }) {
        // Update title
        document.title = title;

        // Standard meta tags
        this.setMeta('description', description);

        // OpenGraph tags
        this.setMeta('og:title', title);
        this.setMeta('og:description', description);
        this.setMeta('og:url', window.location.href);

        if (image) {
            this.setMeta('og:image', image);
        }

        // Twitter cards
        this.setMeta('twitter:card', 'summary_large_image');
        this.setMeta('twitter:title', title);
        this.setMeta('twitter:description', description);

        if (image) {
            this.setMeta('twitter:image', image);
        }

        // Locale
        if (locale) {
            document.documentElement.lang = locale;
            this.setMeta('og:locale', locale);
        }
    }

    setMeta(name, content) {
        const attr = name.includes(':') ? 'property' : 'name';
        let meta = document.querySelector(`meta[${attr}="${name}"]`);

        if (!meta) {
            meta = document.createElement('meta');
            meta.setAttribute(attr, name);
            document.head.appendChild(meta);
        }

        meta.setAttribute('content', content);
    }

    updateLocale({ locale, translations }) {
        // CSS-class pattern for locale
        document.body.dataset.locale = locale;

        // Store translations
        this.translations = translations;

        // Update all [data-i18n] elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            if (translations[key]) {
                el.textContent = translations[key];
            }
        });
    }

    destroy() {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;
        this.lifecycle.destroy();
    }
}
