import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFrontendViteInputs, discoverFrontendHtmlRoutes, verifyFrontendRoutes } from '../../tooling/scripts/frontend-route-utils.js';

function createFixture() {
    const rootDir = mkdtempSync(path.join(os.tmpdir(), 'csma-frontend-routes-'));
    mkdirSync(path.join(rootDir, 'demo'), { recursive: true });
    mkdirSync(path.join(rootDir, 'showcase'), { recursive: true });
    writeFileSync(path.join(rootDir, 'demo', 'index.html'), '<!doctype html><title>demo</title>');
    writeFileSync(path.join(rootDir, 'showcase', 'token-showcase.html'), '<!doctype html><title>showcase</title>');
    return rootDir;
}

function writeManifest(rootDir, routes, modules = ['analytics']) {
    writeFileSync(path.join(rootDir, 'project-manifest.json'), JSON.stringify({
        schemaVersion: 1,
        productType: 'site',
        organization: {
            legalName: 'Example Org',
            productName: 'Example Product',
            supportEmail: 'support@example.com',
            jurisdiction: 'Delaware, United States',
            addressCountry: 'US'
        },
        web: {
            enabled: true,
            baseUrl: 'https://example.com',
            indexable: true,
            defaultLocale: 'en',
            routes
        },
        modules
    }, null, 2));
}

const tempDirs = [];

afterEach(() => {
    tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});

describe('frontend route utils', () => {
    it('discovers canonical frontend routes and vite input names', () => {
        const rootDir = createFixture();
        tempDirs.push(rootDir);
        mkdirSync(path.join(rootDir, 'frontend', 'products'), { recursive: true });
        writeFileSync(path.join(rootDir, 'frontend', 'index.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', 'about.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', 'products', 'index.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', '404.html'), '<!doctype html>');

        const discovered = discoverFrontendHtmlRoutes(rootDir);
        expect(discovered.publicRoutes).toEqual(['/', '/about', '/products']);

        const viteInputs = createFrontendViteInputs(rootDir);
        expect(viteInputs.index).toContain('frontend/index.html');
        expect(viteInputs['about/index']).toContain('frontend/about.html');
        expect(viteInputs['products/index']).toContain('frontend/products/index.html');
        expect(viteInputs['404']).toContain('frontend/404.html');
    });

    it('fails verification when manifest routes and frontend routes diverge', () => {
        const rootDir = createFixture();
        tempDirs.push(rootDir);
        mkdirSync(path.join(rootDir, 'frontend'), { recursive: true });
        writeFileSync(path.join(rootDir, 'frontend', 'index.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', 'about.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', '404.html'), '<!doctype html>');
        writeManifest(rootDir, ['/', '/pricing']);

        const result = verifyFrontendRoutes(rootDir);
        expect(result.ok).toBe(false);
        expect(result.errors.join('\n')).toMatch(/missing planned public routes: \/pricing/i);
        expect(result.errors.join('\n')).toMatch(/not present in project-manifest\.json: \/about/i);
    });

    it('fails verification for mixed delivery artifacts', () => {
        const rootDir = createFixture();
        tempDirs.push(rootDir);
        mkdirSync(path.join(rootDir, 'frontend', 'pages'), { recursive: true });
        writeFileSync(path.join(rootDir, 'frontend', 'index.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', '404.html'), '<!doctype html>');
        writeFileSync(path.join(rootDir, 'frontend', 'pages', 'home.js'), 'export const html = `<main></main>`;');
        writeManifest(rootDir, ['/']);

        const result = verifyFrontendRoutes(rootDir);
        expect(result.ok).toBe(false);
        expect(result.errors.join('\n')).toMatch(/mixed delivery artifacts/i);
    });
});
