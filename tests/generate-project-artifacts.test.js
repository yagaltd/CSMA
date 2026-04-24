import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  formatGenerationSummary,
  generateProjectArtifacts
} from '../tooling/scripts/generate-project-artifacts.js';

const tempDirs = [];

function makeTempRoot() {
  const rootDir = mkdtempSync(path.join(os.tmpdir(), 'csma-artifacts-'));
  tempDirs.push(rootDir);
  return rootDir;
}

function writeManifest(rootDir, manifest) {
  writeFileSync(
    path.join(rootDir, 'project-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
}

function readGenerated(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function baseManifest(overrides = {}) {
  return {
    schemaVersion: 1,
    productType: 'site',
    organization: {
      legalName: 'Acme Labs LLC',
      productName: 'Acme Atlas',
      supportEmail: 'support@example.com',
      jurisdiction: 'California, United States',
      addressCountry: 'US'
    },
    web: {
      enabled: true,
      baseUrl: 'https://example.com',
      indexable: true,
      defaultLocale: 'en',
      routes: ['/', '/pricing', '/docs']
    },
    modules: ['analytics', 'consent', 'auth'],
    ...overrides
  };
}

afterEach(() => {
  for (const rootDir of tempDirs.splice(0)) {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('generate-project-artifacts', () => {
  it.each([
    ['site', 'site'],
    ['public web-app', 'web-app']
  ])('creates the full artifact pack for a %s manifest', (_label, productType) => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({ productType }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([
      'pages/privacy.md',
      'pages/terms.md',
      'pages/cookies.md',
      'public/robots.txt',
      'public/sitemap.xml',
      'public/llms.txt'
    ]);
    expect(readGenerated(rootDir, 'public/robots.txt')).toContain('Allow: /');
    expect(readGenerated(rootDir, 'public/sitemap.xml')).toContain('<loc>https://example.com/pricing</loc>');
    expect(readGenerated(rootDir, 'public/llms.txt')).toContain('https://example.com/docs');
  });

  it('creates only legal drafts plus robots.txt for a non-indexable web app', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      productType: 'web-app',
      web: {
        enabled: true,
        baseUrl: 'https://private.example.com',
        indexable: false,
        defaultLocale: 'en',
        routes: ['/app', '/login']
      }
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([
      'pages/privacy.md',
      'pages/terms.md',
      'pages/cookies.md',
      'public/robots.txt'
    ]);
    expect(readGenerated(rootDir, 'public/robots.txt')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('creates only privacy and terms for a mobile-only project with no web surface', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      productType: 'mobile-app',
      web: {
        enabled: false
      },
      modules: ['auth', 'notifications']
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([
      'pages/privacy.md',
      'pages/terms.md'
    ]);
  });

  it('creates legal drafts and web discovery files for a mobile app with a companion web surface', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      productType: 'mobile-app',
      web: {
        enabled: true,
        baseUrl: 'https://companion.example.com',
        indexable: true,
        defaultLocale: 'en',
        routes: ['/', '/download']
      },
      modules: ['auth', 'notifications', 'analytics']
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([
      'pages/privacy.md',
      'pages/terms.md',
      'pages/cookies.md',
      'public/robots.txt',
      'public/sitemap.xml',
      'public/llms.txt'
    ]);
    expect(readGenerated(rootDir, 'pages/privacy.md')).toContain('| Product type | mobile-app |');
  });

  it('adds module-aware legal sections for privacy, terms, and cookies', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      modules: [
        'analytics',
        'consent',
        'auth',
        'checkout',
        'ai',
        'ai-ui',
        'file-upload',
        'media-capture',
        'file-system',
        'location',
        'notifications'
      ]
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(true);

    const privacy = readGenerated(rootDir, 'pages/privacy.md');
    const terms = readGenerated(rootDir, 'pages/terms.md');
    const cookies = readGenerated(rootDir, 'pages/cookies.md');

    expect(privacy).toContain('## Tracking, Analytics, And Consent');
    expect(privacy).toContain('## Accounts, Sessions, And Credentials');
    expect(privacy).toContain('## Payments, Billing, And Refunds');
    expect(privacy).toContain('## Uploaded Content And Stored Files');
    expect(privacy).toContain('## Location Data');
    expect(privacy).toContain('## Notifications And Communications');
    expect(privacy).toContain('## AI Features And Automated Processing');

    expect(terms).toContain('## Accounts And Access');
    expect(terms).toContain('## Billing, Purchases, And Refunds');
    expect(terms).toContain('## User Content');
    expect(terms).toContain('## Communications');
    expect(terms).toContain('## AI Features');

    expect(cookies).toContain('## Consent Management');
    expect(cookies).toContain('## Session And Login Storage');
    expect(cookies).toContain('Analytics and measurement');
    expect(cookies).toContain('Commerce');
  });

  it('is idempotent and skips existing outputs without changing them', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest());

    const firstRun = generateProjectArtifacts({ rootDir });
    const privacyPath = path.join(rootDir, 'pages', 'privacy.md');
    const firstContents = readGenerated(rootDir, 'pages/privacy.md');
    const firstMtimeMs = statSync(privacyPath).mtimeMs;

    const secondRun = generateProjectArtifacts({ rootDir });
    const secondContents = readGenerated(rootDir, 'pages/privacy.md');
    const secondMtimeMs = statSync(privacyPath).mtimeMs;

    expect(firstRun.ok).toBe(true);
    expect(secondRun.ok).toBe(true);
    expect(secondRun.created).toEqual([]);
    expect(secondRun.skipped).toEqual(firstRun.created);
    expect(secondContents).toBe(firstContents);
    expect(secondMtimeMs).toBe(firstMtimeMs);
  });

  it('preserves manually created files by skipping them', () => {
    const rootDir = makeTempRoot();
    mkdirSync(path.join(rootDir, 'pages'), { recursive: true });
    writeFileSync(path.join(rootDir, 'pages', 'terms.md'), '# Custom Terms\n', 'utf8');
    writeManifest(rootDir, baseManifest());

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(true);
    expect(result.skipped).toContain('pages/terms.md');
    expect(readGenerated(rootDir, 'pages/terms.md')).toBe('# Custom Terms\n');
  });

  it('fails clearly when web.enabled=true and baseUrl is missing', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      web: {
        enabled: true,
        indexable: true,
        defaultLocale: 'en',
        routes: ['/']
      }
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Validation failed: web.baseUrl must be a valid absolute http(s) URL when web.enabled=true'
    );
  });

  it('fails clearly when an indexable web project has no public routes', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      web: {
        enabled: true,
        baseUrl: 'https://example.com',
        indexable: true,
        defaultLocale: 'en',
        routes: []
      }
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Validation failed: web.routes must be non-empty when web.enabled=true and web.indexable=true'
    );
  });

  it('fails clearly when module ids are not canonical', () => {
    const rootDir = makeTempRoot();
    writeManifest(rootDir, baseManifest({
      modules: ['auth', 'made-up-module']
    }));

    const result = generateProjectArtifacts({ rootDir });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Validation failed: unknown module ids: made-up-module');
    expect(formatGenerationSummary(result)).toContain('unknown module ids: made-up-module');
  });
});
