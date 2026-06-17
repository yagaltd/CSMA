import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST_FILENAME = 'project-manifest.json';
const PAGES_DIRNAME = 'pages';
const PUBLIC_DIRNAME = 'public';

const PRODUCT_TYPES = new Set(['site', 'web-app', 'hybrid', 'mobile-app']);
const SECTION_MODULES = {
  tracking: ['analytics', 'consent', 'ab-testing'],
  account: ['auth', 'auth-ui', 'permissions-ui'],
  checkout: ['checkout', 'cart', 'payment-adapters'],
  catalog: ['catalog', 'reviews'],
  content: ['cms-content', 'content-prefetch', 'content-workflow', 'comments', 'edge-search'],
  admin: ['charts', 'admin-audit-log', 'import-export', 'data-table'],
  uploads: ['file-upload', 'media', 'media-capture', 'file-system'],
  location: ['location'],
  notifications: ['notifications'],
  ai: ['ai', 'ai-ui']
};

const DEFAULT_PRIVATE_PATHS = ['/admin', '/api', '/preview'];

function listCanonicalModuleIds() {
  const modulesDir = path.join(ROOT, 'src', 'modules');
  return readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

const CANONICAL_MODULE_IDS = new Set(listCanonicalModuleIds());

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeRoute(route) {
  if (typeof route !== 'string' || route.trim() === '') {
    return null;
  }

  const trimmed = route.trim();
  if (!trimmed.startsWith('/')) {
    return null;
  }

  return trimmed === '/' ? '/' : trimmed.replace(/\/+$/, '');
}

function normalizeBaseUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (!url.protocol.startsWith('http')) {
      return null;
    }
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function dedupe(values) {
  return [...new Set(values)];
}

function validationError(message) {
  return `Validation failed: ${message}`;
}

export function validateProjectManifest(manifest) {
  const errors = [];
  const normalized = {
    schemaVersion: null,
    productType: null,
    organization: null,
    web: {
      enabled: false
    },
    modules: []
  };

  if (!isPlainObject(manifest)) {
    return {
      errors: [validationError('manifest must be a JSON object')],
      manifest: null
    };
  }

  if (manifest.schemaVersion !== 1) {
    errors.push(validationError('schemaVersion must be 1'));
  } else {
    normalized.schemaVersion = 1;
  }

  if (!PRODUCT_TYPES.has(manifest.productType)) {
    errors.push(validationError('productType must be one of: site, web-app, hybrid, mobile-app'));
  } else {
    normalized.productType = manifest.productType;
  }

  if (!isPlainObject(manifest.organization)) {
    errors.push(validationError('organization must be an object'));
  } else {
    const organization = {};
    for (const field of ['legalName', 'productName', 'supportEmail', 'jurisdiction', 'addressCountry']) {
      if (typeof manifest.organization[field] !== 'string' || manifest.organization[field].trim() === '') {
        errors.push(validationError(`organization.${field} must be a non-empty string`));
      } else {
        organization[field] = manifest.organization[field].trim();
      }
    }
    normalized.organization = organization;
  }

  if (!isPlainObject(manifest.web)) {
    errors.push(validationError('web must be an object'));
  } else if (typeof manifest.web.enabled !== 'boolean') {
    errors.push(validationError('web.enabled must be a boolean'));
  } else {
    normalized.web.enabled = manifest.web.enabled;
    if (manifest.web.enabled) {
      const baseUrl = normalizeBaseUrl(manifest.web.baseUrl);
      if (!baseUrl) {
        errors.push(validationError('web.baseUrl must be a valid absolute http(s) URL when web.enabled=true'));
      } else {
        normalized.web.baseUrl = baseUrl;
      }

      if (typeof manifest.web.indexable !== 'boolean') {
        errors.push(validationError('web.indexable must be a boolean when web.enabled=true'));
      } else {
        normalized.web.indexable = manifest.web.indexable;
      }

      if (typeof manifest.web.defaultLocale !== 'string' || manifest.web.defaultLocale.trim() === '') {
        errors.push(validationError('web.defaultLocale must be a non-empty string when web.enabled=true'));
      } else {
        normalized.web.defaultLocale = manifest.web.defaultLocale.trim();
      }

      if (!Array.isArray(manifest.web.routes)) {
        errors.push(validationError('web.routes must be an array when web.enabled=true'));
      } else {
        const routes = dedupe(manifest.web.routes.map(normalizeRoute).filter(Boolean));
        if (routes.length !== manifest.web.routes.length) {
          const invalidRoutes = manifest.web.routes.filter((route) => !normalizeRoute(route));
          if (invalidRoutes.length > 0) {
            errors.push(validationError('web.routes entries must be absolute paths like "/" or "/pricing"'));
          }
        }
        normalized.web.routes = routes;
      }

      if (normalized.web.indexable && (!normalized.web.routes || normalized.web.routes.length === 0)) {
        errors.push(validationError('web.routes must be non-empty when web.enabled=true and web.indexable=true'));
      }
    }
  }

  if (!Array.isArray(manifest.modules)) {
    errors.push(validationError('modules must be an array'));
  } else {
    const invalidModuleIds = manifest.modules.filter((moduleId) => !CANONICAL_MODULE_IDS.has(moduleId));
    if (invalidModuleIds.length > 0) {
      errors.push(validationError(`unknown module ids: ${invalidModuleIds.join(', ')}`));
    } else {
      normalized.modules = dedupe(manifest.modules);
    }
  }

  return {
    errors,
    manifest: errors.length === 0 ? normalized : null
  };
}

function includesAny(modules, ids) {
  return ids.some((id) => modules.includes(id));
}

function relativeRouteList(routes) {
  return routes.map((route) => `- \`${route}\``).join('\n');
}

function absoluteRouteList(baseUrl, routes) {
  return routes
    .map((route) => `- ${new URL(route, `${baseUrl}/`).toString()}`)
    .join('\n');
}

function buildSharedDraftHeader(title, manifest, note) {
  const scope = manifest.web.enabled ? 'web and app surfaces' : 'app surfaces';
  return `# ${title}

> Generated scaffold only. Not legal advice. Replace every \`TODO\` before publishing.

## Snapshot

| Field | Value |
|:--|:--|
| Product | ${manifest.organization.productName} |
| Organization | ${manifest.organization.legalName} |
| Product type | ${manifest.productType} |
| Support contact | ${manifest.organization.supportEmail} |
| Jurisdiction | ${manifest.organization.jurisdiction} |
| Country | ${manifest.organization.addressCountry} |
| Coverage | ${scope} |

## Drafting Notes

- ${note}
- TODO: Confirm retention periods, subprocessors, regulatory triggers, and required disclosures with counsel.
- TODO: Replace generic placeholders with actual operational details before release.
`;
}

function buildPrivacyDraft(manifest) {
  const modules = manifest.modules;
  const webSurface = manifest.web.enabled
    ? `\n## Public Web Surface\n\n- Base URL: \`${manifest.web.baseUrl}\`\n- Default locale: \`${manifest.web.defaultLocale}\`\n- Public routes planned in the manifest:\n${relativeRouteList(manifest.web.routes)}\n`
    : '\n## Public Web Surface\n\n- No web surface is currently declared in `project-manifest.json`.\n';

  const sections = [];

  if (includesAny(modules, SECTION_MODULES.tracking)) {
    sections.push(`## Tracking, Analytics, And Consent

- TODO: Describe what telemetry, analytics events, or consent choices are collected.
- TODO: State whether tracking is optional, essential-only, or region-specific.
- TODO: Document consent withdrawal behavior and preference storage.`);
  }

  if (includesAny(modules, SECTION_MODULES.account)) {
    sections.push(`## Accounts, Sessions, And Credentials

- TODO: Describe account registration, authentication methods, session duration, and credential handling.
- TODO: State how password resets, account recovery, and access revocation are handled.
- TODO: Confirm whether third-party identity providers are used.`);
  }

  if (includesAny(modules, SECTION_MODULES.checkout)) {
    sections.push(`## Payments, Billing, Cart, And Refunds

- TODO: List cart, billing, checkout, coupon, tax, shipping, and payment-session data collected.
- TODO: State who validates authoritative totals and who processes payment information.
- TODO: State invoicing, tax handling, refund policy references, and charge dispute workflow.
- TODO: Confirm that provider secrets and payment confirmation live outside the frontend.`);
  }

  if (includesAny(modules, SECTION_MODULES.catalog)) {
    sections.push(`## Catalog, Reviews, And Commerce Content

- TODO: Describe product/content catalog data, inventory/availability sources, review data, and purchase-verification rules.
- TODO: State moderation, fraud-prevention, retention, and deletion rules for reviews.
- TODO: Identify which catalog fields are public CDN data versus backend-authoritative data.`);
  }

  if (includesAny(modules, SECTION_MODULES.content)) {
    sections.push(`## Content, Comments, Search, And Publishing Workflow

- TODO: Describe pages, posts, comments, search queries, workflow states, draft/publish data, and moderation rules.
- TODO: State whether comments/search/workflow data is public, private, or role-gated.
- TODO: Identify backend/edge companions responsible for durable writes, moderation, private indexes, and workflow persistence.`);
  }

  if (includesAny(modules, SECTION_MODULES.admin)) {
    sections.push(`## Admin, Metrics, Imports, Exports, And Audit Logs

- TODO: Describe dashboard metrics, imported/exported files, audit log data, actor identifiers, and retention rules.
- TODO: State who can access admin data and how backend authority enforces that access.
- TODO: Document whether audit logs are immutable and where authoritative records are stored.`);
  }

  if (includesAny(modules, SECTION_MODULES.uploads)) {
    sections.push(`## Uploaded Content And Stored Files

- TODO: Describe files, media, or documents users can upload or generate.
- TODO: State storage locations, retention periods, moderation/review rules, and deletion workflow.
- TODO: Clarify whether uploaded content is shared publicly, privately, or with collaborators.`);
  }

  if (includesAny(modules, SECTION_MODULES.location)) {
    sections.push(`## Location Data

- TODO: Describe whether precise or approximate location is collected, inferred, or requested.
- TODO: State why location data is needed and how long it is retained.
- TODO: Explain how users can deny or revoke location access.`);
  }

  if (includesAny(modules, SECTION_MODULES.notifications)) {
    sections.push(`## Notifications And Communications

- TODO: Describe transactional emails, push notifications, SMS, or in-app communications.
- TODO: Clarify which messages are mandatory versus optional marketing messages.
- TODO: State opt-out methods and delivery partners.`);
  }

  if (includesAny(modules, SECTION_MODULES.ai)) {
    sections.push(`## AI Features And Automated Processing

- TODO: Describe prompts, inputs, outputs, moderation, and human review expectations.
- TODO: State whether user content is used to improve models, generate summaries, or power assistants.
- TODO: Explain known limitations, review expectations, and escalation paths for incorrect output.`);
  }

  return `${buildSharedDraftHeader('Privacy Policy', manifest, 'Fill in the privacy obligations for the declared modules and distribution surfaces.')}
## Information We Collect

- TODO: List the categories of personal data, operational data, device data, and support data collected.
- TODO: Distinguish between user-provided data, automatically collected data, and data received from third parties.
${webSurface}
## How We Use Information

- TODO: Explain how data supports account operation, service delivery, security, support, and legal compliance.
- TODO: Add product-specific lawful bases or consent notes where required.

## Sharing And Disclosure

- TODO: List service-provider categories, legal disclosures, and business transfer disclosures.
- TODO: Confirm whether data is sold, shared for advertising, or used for cross-context behavioral profiling.

## Retention And Deletion

- TODO: Define retention periods by data category.
- TODO: Explain deletion timelines, backup handling, and exception cases.

## Security

- TODO: Summarize the operational security posture without making absolute guarantees.
- TODO: Add reporting instructions for suspected incidents or abuse.

## International Transfers

- TODO: State whether data moves across borders and what safeguards apply.

## Your Rights

- TODO: Add the rights relevant to your jurisdictions, such as access, deletion, correction, objection, portability, or appeal.
- TODO: Explain how to submit a privacy request and how identity is verified.

${sections.join('\n\n') || '## Product-Specific Processing\n\n- TODO: Add any module-specific privacy sections needed for this product.'}

## Contact

- Support email: ${manifest.organization.supportEmail}
- TODO: Add mailing address, privacy lead, and regulator contact language if required.
`;
}

function buildTermsDraft(manifest) {
  const modules = manifest.modules;
  const sections = [];

  if (includesAny(modules, SECTION_MODULES.account)) {
    sections.push(`## Accounts And Access

- TODO: Define eligibility rules, account responsibilities, credential security expectations, and suspension triggers.
- TODO: State whether accounts may be shared, transferred, or terminated for misuse.`);
  }

  if (includesAny(modules, SECTION_MODULES.checkout)) {
    sections.push(`## Billing, Cart, Purchases, And Refunds

- TODO: Describe cart behavior, pricing notices, taxes, subscriptions, refund terms, and chargeback handling.
- TODO: State that final prices, coupons, tax, shipping, and payment confirmation are validated by backend/edge systems.
- TODO: State whether purchases are final, prorated, or subject to separate commercial terms.`);
  }

  if (includesAny(modules, SECTION_MODULES.catalog)) {
    sections.push(`## Catalog, Availability, Reviews, And Ratings

- TODO: Explain catalog accuracy, availability, pricing display rules, review submission terms, moderation rights, and fraud controls.
- TODO: State that inventory, private pricing, review verification, and moderation authority are backend-controlled.`);
  }

  if (includesAny(modules, SECTION_MODULES.content)) {
    sections.push(`## Content, Comments, Search, And Publishing

- TODO: Define rules for comments, draft/published content, search use, prohibited content, moderation, takedown, and workflow responsibilities.
- TODO: State whether publishing or moderation decisions are human, automated, or backend-enforced.`);
  }

  if (includesAny(modules, SECTION_MODULES.admin)) {
    sections.push(`## Admin Tools, Imports, Exports, Metrics, And Audit Records

- TODO: Define authorized admin use, import/export responsibilities, audit log expectations, and data accuracy obligations.
- TODO: State that audit records and private metrics are authoritative only when backed by the configured backend/edge system.`);
  }

  if (includesAny(modules, SECTION_MODULES.uploads)) {
    sections.push(`## User Content

- TODO: State what users may upload, store, or publish through the product.
- TODO: Clarify ownership, license grants, moderation rights, and takedown workflow.`);
  }

  if (includesAny(modules, SECTION_MODULES.notifications)) {
    sections.push(`## Communications

- TODO: Describe product communications, service notices, and consent expectations for optional outreach.
- TODO: Add any rules around carrier charges, message frequency, or unsubscribe behavior if relevant.`);
  }

  if (includesAny(modules, SECTION_MODULES.ai)) {
    sections.push(`## AI Features

- TODO: Explain acceptable use of AI tools, review expectations, prohibited prompts, and output limitations.
- TODO: State whether AI outputs may be inaccurate and require human review before reliance.`);
  }

  return `${buildSharedDraftHeader('Terms of Service', manifest, 'Convert this draft into enforceable product terms with counsel before launch.')}
## Acceptance Of Terms

- TODO: Define when users accept these terms and which surfaces or products they cover.
- TODO: State the effective date and versioning policy.

## Services Covered

- TODO: Describe the product, companion experiences, and any excluded services.
- TODO: Link to related policies, such as privacy, cookies, or separate enterprise terms.

## Acceptable Use

- TODO: Add prohibited activities, abuse controls, reverse engineering limits, and security restrictions.
- TODO: Define enforcement actions for violations.

${sections.join('\n\n') || '## Product-Specific Terms\n\n- TODO: Add service-specific restrictions and responsibilities for the declared modules.'}

## Intellectual Property

- TODO: State ownership of the service, marks, content, and permitted use of materials.

## Availability And Changes

- TODO: Explain maintenance windows, beta features, feature removals, and service modifications.

## Disclaimers

- TODO: Add service disclaimers, warranty limitations, and jurisdiction-specific carve-outs.

## Limitation Of Liability

- TODO: Add the liability cap and excluded damages language appropriate to the jurisdiction.

## Governing Law

- Governing jurisdiction placeholder: ${manifest.organization.jurisdiction}
- TODO: Confirm venue, arbitration, class action waiver, or consumer-law exceptions.

## Contact

- Support email: ${manifest.organization.supportEmail}
- TODO: Add legal notices address and agent details if needed.
`;
}

function buildCookiesDraft(manifest) {
  const modules = manifest.modules;
  const trackingEnabled = includesAny(modules, SECTION_MODULES.tracking);
  const authEnabled = includesAny(modules, SECTION_MODULES.account);
  const checkoutEnabled = includesAny(modules, SECTION_MODULES.checkout);
  const contentEnabled = includesAny(modules, SECTION_MODULES.content);
  const adminEnabled = includesAny(modules, SECTION_MODULES.admin);

  const cookieCategories = [
    '- Strictly necessary: TODO: list essential session, security, or load-balancing technologies.',
    trackingEnabled
      ? '- Analytics and measurement: TODO: describe aggregated usage, attribution, or experiment cookies.'
      : '- Analytics and measurement: TODO: confirm whether analytics cookies are not used.',
    '- Preferences: TODO: list language, theme, accessibility, or consent-preference storage.',
    checkoutEnabled
      ? '- Commerce: TODO: describe cart, checkout, payment-session, or fraud-prevention storage if used.'
      : '- Commerce: TODO: confirm whether commerce-related storage is not used.',
    contentEnabled
      ? '- Content and search: TODO: describe comments, drafts, workflow, search-query, or preference storage if used.'
      : '- Content and search: TODO: confirm whether content/search storage is not used.',
    adminEnabled
      ? '- Admin and audit: TODO: describe admin UI preferences, import/export state, dashboard filters, and audit-view storage if used.'
      : '- Admin and audit: TODO: confirm whether admin-related browser storage is not used.'
  ];

  const consentSection = trackingEnabled
    ? `## Consent Management

- TODO: Explain the consent banner, preference center, and withdrawal flow.
- TODO: State regional differences for consent defaults and whether consent is stored locally or server-side.`
    : `## Consent Management

- TODO: Confirm whether the product uses essential-only storage and whether a consent banner is still shown.`;

  const authSection = authEnabled
    ? `## Session And Login Storage

- TODO: Describe authentication cookies, token storage, session expiration, and logout invalidation.`
    : '';

  return `${buildSharedDraftHeader('Cookie Policy', manifest, 'This draft covers browser cookies and similar client-side storage for the web surface only.')}
## Scope

- Base URL: \`${manifest.web.baseUrl}\`
- Public routes currently declared:
${relativeRouteList(manifest.web.routes)}
- TODO: Confirm whether this policy also covers mobile webviews, embedded browsers, or desktop shells.

## Technologies Used

- TODO: List cookies, local storage, session storage, SDK storage, pixels, tags, or similar technologies.
- TODO: Distinguish first-party storage from third-party storage.

## Categories

${cookieCategories.join('\n')}

${consentSection}

${authSection}

## Managing Cookies

- TODO: Explain browser controls, in-product controls, and any impact of disabling storage.
- TODO: Describe how users can revisit choices after initial setup.

## Changes To This Policy

- TODO: State how updates will be announced and when changes take effect.
`;
}

function buildRobotsTxt(manifest) {
  if (!manifest.web.indexable) {
    return 'User-agent: *\nDisallow: /\n';
  }

  const lines = ['User-agent: *', 'Allow: /'];
  for (const route of DEFAULT_PRIVATE_PATHS) {
    lines.push(`Disallow: ${route}`);
  }
  lines.push(`Sitemap: ${new URL('/sitemap.xml', `${manifest.web.baseUrl}/`).toString()}`);
  return `${lines.join('\n')}\n`;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildSitemapXml(manifest) {
  const urls = manifest.web.routes.map((route) => {
    const absoluteUrl = new URL(route, `${manifest.web.baseUrl}/`).toString();
    return `  <url>\n    <loc>${escapeXml(absoluteUrl)}</loc>\n  </url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

function buildLlmsTxt(manifest) {
  return `# ${manifest.organization.productName}

Generated project discovery file for public routes. Replace TODO placeholders with a final product summary before launch.

- Product: ${manifest.organization.productName}
- Organization: ${manifest.organization.legalName}
- Base URL: ${manifest.web.baseUrl}
- Locale: ${manifest.web.defaultLocale}
- TODO: Add a short description of the site or app for downstream agents and readers.

## Public Routes

${absoluteRouteList(manifest.web.baseUrl, manifest.web.routes)}

## Notes

- This route inventory is generated from \`project-manifest.json\`.
- TODO: Add route descriptions, support boundaries, and crawler expectations if needed.
`;
}

function buildArtifactPlan(manifest) {
  const artifacts = [
    {
      relativePath: path.join(PAGES_DIRNAME, 'privacy.md'),
      contents: buildPrivacyDraft(manifest)
    },
    {
      relativePath: path.join(PAGES_DIRNAME, 'terms.md'),
      contents: buildTermsDraft(manifest)
    }
  ];

  if (manifest.web.enabled) {
    artifacts.push(
      {
        relativePath: path.join(PAGES_DIRNAME, 'cookies.md'),
        contents: buildCookiesDraft(manifest)
      },
      {
        relativePath: path.join(PUBLIC_DIRNAME, 'robots.txt'),
        contents: buildRobotsTxt(manifest)
      }
    );

    if (manifest.web.indexable) {
      artifacts.push(
        {
          relativePath: path.join(PUBLIC_DIRNAME, 'sitemap.xml'),
          contents: buildSitemapXml(manifest)
        },
        {
          relativePath: path.join(PUBLIC_DIRNAME, 'llms.txt'),
          contents: buildLlmsTxt(manifest)
        }
      );
    }
  }

  return artifacts;
}

function ensureParentDirectory(rootDir, relativePath) {
  mkdirSync(path.join(rootDir, path.dirname(relativePath)), { recursive: true });
}

function loadManifest(rootDir) {
  const manifestPath = path.join(rootDir, MANIFEST_FILENAME);
  if (!existsSync(manifestPath)) {
    return {
      manifestPath,
      manifest: null,
      errors: [`Missing ${MANIFEST_FILENAME} at ${manifestPath}`]
    };
  }

  try {
    return {
      manifestPath,
      manifest: JSON.parse(readFileSync(manifestPath, 'utf8')),
      errors: []
    };
  } catch (error) {
    return {
      manifestPath,
      manifest: null,
      errors: [`Failed to parse ${MANIFEST_FILENAME}: ${error.message}`]
    };
  }
}

export function generateProjectArtifacts({ rootDir = ROOT } = {}) {
  const loaded = loadManifest(rootDir);
  if (loaded.errors.length > 0) {
    return {
      ok: false,
      manifestPath: loaded.manifestPath,
      created: [],
      skipped: [],
      errors: loaded.errors
    };
  }

  const validated = validateProjectManifest(loaded.manifest);
  if (validated.errors.length > 0) {
    return {
      ok: false,
      manifestPath: loaded.manifestPath,
      created: [],
      skipped: [],
      errors: validated.errors
    };
  }

  const created = [];
  const skipped = [];

  for (const artifact of buildArtifactPlan(validated.manifest)) {
    const targetPath = path.join(rootDir, artifact.relativePath);
    if (existsSync(targetPath)) {
      skipped.push(artifact.relativePath);
      continue;
    }
    ensureParentDirectory(rootDir, artifact.relativePath);
    writeFileSync(targetPath, artifact.contents, 'utf8');
    created.push(artifact.relativePath);
  }

  return {
    ok: true,
    manifestPath: loaded.manifestPath,
    created,
    skipped,
    errors: []
  };
}

export function formatGenerationSummary(result) {
  const lines = [`Manifest: ${result.manifestPath}`];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    return lines.join('\n');
  }

  lines.push(`Created (${result.created.length}):`);
  if (result.created.length === 0) {
    lines.push('- none');
  } else {
    for (const createdPath of result.created) {
      lines.push(`- ${createdPath}`);
    }
  }

  lines.push(`Skipped existing (${result.skipped.length}):`);
  if (result.skipped.length === 0) {
    lines.push('- none');
  } else {
    for (const skippedPath of result.skipped) {
      lines.push(`- ${skippedPath}`);
    }
  }

  return lines.join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = generateProjectArtifacts();
  const summary = formatGenerationSummary(result);
  if (result.ok) {
    console.log(summary);
  } else {
    console.error(summary);
    process.exitCode = 1;
  }
}
