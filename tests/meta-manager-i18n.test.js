// @vitest-environment jsdom
import './helpers/storage-polyfill.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EventBus from '../src/runtime/EventBus.js';
import { MetaManager } from '../src/runtime/MetaManager.js';
import { MetaManagerModuleService } from '../src/modules/meta-manager/services/MetaManagerModuleService.js';
import { I18n, getLocaleDirection } from '../src/modules/i18n/services/I18n.js';

describe('I18n document direction', () => {
    let eventBus;

    beforeEach(() => {
        document.documentElement.lang = '';
        document.documentElement.dir = '';
        localStorage.clear();
        eventBus = new EventBus();
    });

    afterEach(() => {
        document.documentElement.lang = '';
        document.documentElement.dir = '';
        localStorage.clear();
    });

    it('applies lang and dir for the default locale immediately', () => {
        const i18n = new I18n(eventBus, 'en-US');

        expect(i18n.locale).toBe('en-US');
        expect(i18n.direction).toBe('ltr');
        expect(document.documentElement.lang).toBe('en-US');
        expect(document.documentElement.dir).toBe('ltr');
    });

    it('switches the document to rtl locales and publishes direction metadata', async () => {
        const i18n = new I18n(eventBus, 'en-US');
        await i18n.loadLocale('en-US', { common: { label: 'Hello' } });
        await i18n.loadLocale('ar-SA', { common: { label: 'مرحبا' } });

        const languageChanges = [];
        eventBus.subscribe('LANGUAGE_CHANGED', (payload) => {
            languageChanges.push(payload);
        });

        i18n.setLocale('ar-SA');

        expect(i18n.direction).toBe('rtl');
        expect(document.documentElement.lang).toBe('ar-SA');
        expect(document.documentElement.dir).toBe('rtl');
        expect(languageChanges.at(-1)).toEqual({
            from: 'en-US',
            to: 'ar-SA',
            fromDirection: 'ltr',
            toDirection: 'rtl',
            direction: 'rtl'
        });
    });

    it('normalizes locale subtags when resolving direction', () => {
        expect(getLocaleDirection('he-IL')).toBe('rtl');
        expect(getLocaleDirection('fa_IR')).toBe('rtl');
        expect(getLocaleDirection('en-GB')).toBe('ltr');
        expect(getLocaleDirection('')).toBe('ltr');
    });
});

describe('MetaManager localized SEO', () => {
    let eventBus;
    let manager;

    beforeEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.title = '';
        eventBus = new EventBus();
        manager = new MetaManager(eventBus, { document });
    });

    afterEach(() => {
        manager.destroy();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.documentElement.lang = '';
        document.documentElement.dir = '';
    });

    it('renders canonical, alternates, and locale Open Graph tags from PAGE_CHANGED', async () => {
        await eventBus.publish('PAGE_CHANGED', {
            title: 'Pricing',
            description: 'Localized pricing page',
            locale: 'en-US',
            canonical: 'https://example.com/en/pricing',
            alternates: [
                { locale: 'en-US', href: 'https://example.com/en/pricing' },
                { locale: 'fr-FR', href: 'https://example.com/fr/pricing' }
            ]
        });

        expect(document.documentElement.lang).toBe('en-US');
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/en/pricing');

        const alternateLinks = Array.from(document.querySelectorAll('link[rel="alternate"]'));
        expect(alternateLinks).toHaveLength(2);
        expect(alternateLinks.map((node) => node.getAttribute('hreflang'))).toEqual(['en-US', 'fr-FR']);

        expect(document.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('en-US');
        const ogAlternateLocales = Array.from(document.querySelectorAll('meta[property="og:locale:alternate"]'))
            .map((node) => node.getAttribute('content'));
        expect(ogAlternateLocales).toEqual(['fr-FR']);
    });

    it('removes stale alternates when page metadata is replaced', async () => {
        await eventBus.publish('PAGE_CHANGED', {
            title: 'Pricing',
            description: 'Localized pricing page',
            locale: 'en-US',
            canonical: 'https://example.com/en/pricing',
            alternates: [
                { locale: 'en-US', href: 'https://example.com/en/pricing' },
                { locale: 'fr-FR', href: 'https://example.com/fr/pricing' }
            ]
        });

        await eventBus.publish('PAGE_CHANGED', {
            title: 'Pricing',
            description: 'Localized pricing page',
            locale: 'en-US',
            canonical: 'https://example.com/en/pricing'
        });

        expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(0);
        expect(document.querySelectorAll('meta[property="og:locale:alternate"]')).toHaveLength(0);
    });
});

describe('MetaManagerModuleService localized page binding', () => {
    let eventBus;
    let manager;
    let moduleService;
    let i18n;

    beforeEach(async () => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.title = '';
        eventBus = new EventBus();
        manager = new MetaManager(eventBus, { document });
        i18n = new I18n(eventBus, 'en-US');
        await i18n.loadLocale('en-US', { seo: { title: 'Pricing', description: 'US pricing' } });
        await i18n.loadLocale('fr-FR', { seo: { title: 'Tarifs', description: 'Tarifs FR' } });
        moduleService = new MetaManagerModuleService(eventBus).init({
            metaManager: manager,
            i18nService: i18n
        });
    });

    afterEach(() => {
        moduleService.destroy();
        manager.destroy();
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.documentElement.lang = '';
        document.documentElement.dir = '';
        localStorage.clear();
    });

    it('applies localized SEO once and re-applies on language change', async () => {
        const binding = moduleService.bindLocalizedPage(({ locale, i18n: i18nService }) => ({
            title: i18nService.t('seo.title'),
            description: i18nService.t('seo.description'),
            locale,
            canonical: `https://example.com/${locale}/pricing`,
            alternates: [
                { locale: 'en-US', href: 'https://example.com/en-US/pricing' },
                { locale: 'fr-FR', href: 'https://example.com/fr-FR/pricing' }
            ]
        }));

        expect(document.title).toBe('Pricing');
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/en-US/pricing');

        i18n.setLocale('fr-FR');
        await Promise.resolve();

        expect(document.title).toBe('Tarifs');
        expect(document.documentElement.lang).toBe('fr-FR');
        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/fr-FR/pricing');
        expect(document.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('fr-FR');

        binding.dispose();
        i18n.setLocale('en-US');
        await Promise.resolve();
        expect(document.title).toBe('Tarifs');
    });
});
