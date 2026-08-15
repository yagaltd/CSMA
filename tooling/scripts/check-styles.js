#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';
import { collectComponentReference } from './generate-component-reference.js';
import { collectTokenReference } from './generate-token-reference.js';
import { toolingGeneratedPath } from './generated-paths.js';
import { validateInteractiveComponentCss } from '../../src/ui/validation/componentCssContracts.js';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.factory', 'platforms']);
const WHITELIST_FILES = new Set(['tooling/scripts/check-styles.js']);
const ALLOWED_EXTENSIONS = new Set(['.css', '.scss', '.js', '.ts', '.tsx', '.jsx', '.html', '.md', '.json']);
const MAIN_CSS = 'src/style/main.css';
const APP_CSS_FILES = ['demo/app.css'];
const COMPONENTS_DIR = 'src/ui/components';
const COMPONENT_INDEX = 'src/ui/components/index.css';
const UI_INIT = 'src/ui/init.js';
const COMPONENT_SCHEMA = 'tooling/schemas/component-manifest.schema.json';
const GENERATED_COMPONENT_REFERENCE = relative(ROOT, toolingGeneratedPath('component-reference.json'));
const GENERATED_TOKEN_REFERENCE = relative(ROOT, toolingGeneratedPath('token-reference.json'));
const PATTERNS_DIR = 'src/ui/patterns';
const PATTERN_INDEX = 'src/ui/patterns/index.css';
const HARDENING_DIR = 'src/style/foundation/hardening';

const RULES = [
  {
    regex: /\.btn\b/,
    message: 'Legacy .btn class detected (use foundation .button component).',
    appliesTo: (filePath) => !filePath.endsWith('.md')
  },
  {
    regex: /--color-[\w-]+/,
    message: 'Legacy --color-* token detected (use semantic theme tokens).',
    appliesTo: (filePath) => !filePath.endsWith('.md')
  },
  {
    regex: /foundation\/components\/[\w/-]+\.css|css\/foundation\/components\//,
    message: 'Reference to removed foundation component stylesheet detected.',
    appliesTo: (filePath) => filePath.startsWith('src/') || filePath === 'demo/index.html'
  },
  {
    regex: /foundation\/tokens\.css|foundation\/themes\/light\.css|foundation\/themes\/dark\.css/,
    message: 'Import tokens via generated/tokens.css rather than raw foundation theme files.',
    appliesTo: (filePath) =>
      filePath.startsWith('src/') &&
      !filePath.endsWith('.md') &&
      filePath !== MAIN_CSS
  },
  {
    regex: /--fx-[\w-]+|--spacing-[\w-]+|--corner-[\w-]+/,
    message: 'Legacy token family detected (use semantic, scale, or recipe tokens from generated/tokens.css).',
    appliesTo: (filePath) =>
      filePath.startsWith('src/') &&
      !filePath.endsWith('.md')
  },
  {
    regex: /foundation\/utilities\.css/,
    message: 'Legacy foundation/utilities.css import detected (renamed to foundation/layout.css).',
    appliesTo: (filePath) => filePath.startsWith('src/') && filePath !== MAIN_CSS
  },
  {
    regex: /foundation\/hardening\.css/,
    message: 'Legacy foundation/hardening.css import detected (split into foundation/hardening/ directory).',
    appliesTo: (filePath) => filePath.startsWith('src/') && filePath !== MAIN_CSS
  },
  {
    regex: /css\/theme\.css/,
    message: 'Legacy theme.css import detected (themes now in design-tokens.json).',
    appliesTo: (filePath) => filePath.startsWith('src/') && filePath !== MAIN_CSS
  }
];

const findings = [];

function shouldIgnore(path) {
  return path.split(/[/\\]/).some((part) => IGNORE_DIRS.has(part));
}

function scanFile(filePath) {
  const ext = extname(filePath);
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return;
  }

  const relPath = relative(ROOT, filePath);
  if (WHITELIST_FILES.has(relPath)) {
    return;
  }

  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    RULES.forEach((rule) => {
      if (rule.appliesTo && !rule.appliesTo(relPath)) {
        return;
      }
      if (rule.regex.test(line)) {
        findings.push({
          file: relPath,
          line: idx + 1,
          message: rule.message,
          sample: line.trim().slice(0, 160)
        });
      }
    });
  });
}

function walk(dirPath) {
  if (shouldIgnore(relative(ROOT, dirPath))) {
    return;
  }

  readdirSync(dirPath).forEach((entry) => {
    const fullPath = join(dirPath, entry);
    if (shouldIgnore(relative(ROOT, fullPath))) {
      return;
    }
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
    } else {
      scanFile(fullPath);
    }
  });
}

function addFinding(file, line, message, sample) {
  findings.push({ file, line, message, sample });
}

function validateThemeContract() {
  const mainPath = join(ROOT, MAIN_CSS);

  if (!existsSync(mainPath)) {
    addFinding(MAIN_CSS, 1, 'Missing main CSS entry point.', MAIN_CSS);
    return;
  }

  const mainCss = readFileSync(mainPath, 'utf8');
  if (!mainCss.includes("@import '../ui/components/index.css';")) {
    addFinding(MAIN_CSS, 1, 'main.css must import src/ui/components/index.css.', "@import '../ui/components/index.css';");
  }

  // Check hardening directory exists
  const hardeningPath = join(ROOT, HARDENING_DIR);
  if (existsSync(hardeningPath)) {
    const expectedFiles = ['text-overflow.css', 'states.css', 'accessibility.css', 'i18n.css', 'loading.css', 'error.css'];
    expectedFiles.forEach((file) => {
      if (!existsSync(join(hardeningPath, file))) {
        addFinding(HARDENING_DIR + '/' + file, 1, 'Missing hardening module file.', file);
      }
    });
  } else {
    addFinding(HARDENING_DIR, 1, 'Missing foundation/hardening/ directory.', HARDENING_DIR);
  }
}

function validateAppStyles() {
  APP_CSS_FILES.forEach((relPath) => {
    const appCssPath = join(ROOT, relPath);
    if (!existsSync(appCssPath)) {
      addFinding(relPath, 1, 'Missing app CSS entry point.', relPath);
      return;
    }

    const appCss = readFileSync(appCssPath, 'utf8');
    const hasTokens = appCss.includes("@import '../generated/tokens.css';") ||
                      appCss.includes("@import '../src/generated/tokens.css';");
    const hasMain = appCss.includes("@import '../../src/style/main.css';") ||
                    appCss.includes("@import '../src/style/main.css';");

    if (!hasTokens) {
      addFinding(relPath, 1, 'App CSS must import generated/tokens.css.', "@import '../src/generated/tokens.css';");
    }
    if (!hasMain) {
      addFinding(relPath, 1, 'App CSS must import src/style/main.css.', "@import '../src/style/main.css';");
    }
  });
}

function validateComponentIndex() {
  const componentsRoot = join(ROOT, COMPONENTS_DIR);
  const indexPath = join(ROOT, COMPONENT_INDEX);
  const imported = new Set(
    [...readFileSync(indexPath, 'utf8').matchAll(/@import ['"]\.\/([^/]+)\/[^'"\n]+\.css['"]/g)].map((match) => match[1])
  );

  readdirSync(componentsRoot).forEach((entry) => {
    const fullPath = join(componentsRoot, entry);
    if (!statSync(fullPath).isDirectory()) {
      return;
    }
    const expectedCss = join(fullPath, `${entry}.css`);
    if (!existsSync(expectedCss)) {
      return;
    }
    if (!imported.has(entry)) {
      addFinding(COMPONENT_INDEX, 1, 'Component CSS file is missing from src/ui/components/index.css.', `${entry}/${basename(expectedCss)}`);
    }
  });
}

function validatePatternIndex() {
  const patternsRoot = join(ROOT, PATTERNS_DIR);
  const indexPath = join(ROOT, PATTERN_INDEX);

  // Patterns are optional — skip if directory doesn't exist
  if (!existsSync(patternsRoot)) {
    return;
  }

  if (!existsSync(indexPath)) {
    addFinding(PATTERN_INDEX, 1, 'Missing pattern index stylesheet.', PATTERN_INDEX);
    return;
  }

  const imported = new Set(
    [...readFileSync(indexPath, 'utf8').matchAll(/@import ['"]\.\/([^/]+)\/[^'"\n]+\.css['"]/g)].map((match) => match[1])
  );

  readdirSync(patternsRoot).forEach((entry) => {
    const fullPath = join(patternsRoot, entry);
    if (!statSync(fullPath).isDirectory()) {
      return;
    }
    const expectedCss = join(fullPath, `${entry}.css`);
    if (!existsSync(expectedCss)) {
      return;
    }
    if (!imported.has(entry)) {
      addFinding(PATTERN_INDEX, 1, 'Pattern CSS file is missing from src/ui/patterns/index.css.', `${entry}/${basename(expectedCss)}`);
    }
  });
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSemver(value) {
  return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function validateManifestShape(manifest, relPath) {
  if (!isObject(manifest)) {
    addFinding(relPath, 1, 'Component manifest must be a JSON object.', relPath);
    return;
  }

  const { eccac, component, contracts, dependencies, metadata, aiUi } = manifest;

  if (!isObject(eccac) || !isSemver(eccac.version) || !isSemver(eccac.spec)) {
    addFinding(relPath, 1, 'Manifest eccac.version and eccac.spec must be semver strings.', JSON.stringify(eccac || {}));
  }

  if (!isObject(component)) {
    addFinding(relPath, 1, 'Manifest must contain component metadata.', 'component');
  } else {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(component.name || '')) {
      addFinding(relPath, 1, 'component.name must be kebab-case.', String(component.name || ''));
    }
    if (!['I', 'II'].includes(component.type)) {
      addFinding(relPath, 1, 'component.type must be "I" or "II".', String(component.type || ''));
    }
    if (!isNonEmptyString(component.owner)) {
      addFinding(relPath, 1, 'component.owner is required.', String(component.owner || ''));
    }
    if (!['draft', 'active', 'stable', 'deprecated', 'retired'].includes(component.lifecycle)) {
      addFinding(relPath, 1, 'component.lifecycle must be a known lifecycle value.', String(component.lifecycle || ''));
    }
    if (!['experimental', 'stable'].includes(component.stability)) {
      addFinding(relPath, 1, 'component.stability must be "experimental" or "stable".', String(component.stability || ''));
    }
  }

  if (!isObject(contracts) || !isStringArray(contracts.published) || !isStringArray(contracts.subscribed)) {
    addFinding(relPath, 1, 'contracts.published and contracts.subscribed must be string arrays.', JSON.stringify(contracts || {}));
  }

  if (!isObject(dependencies) || !isStringArray(dependencies.runtime) || !isStringArray(dependencies.components)) {
    addFinding(relPath, 1, 'dependencies.runtime and dependencies.components must be string arrays.', JSON.stringify(dependencies || {}));
  }

  if (!isObject(metadata) || !isNonEmptyString(metadata.description) || metadata.description.trim().length < 10) {
    addFinding(relPath, 1, 'metadata.description must be a descriptive string.', JSON.stringify(metadata || {}));
  }

  if (!isObject(aiUi)) {
    addFinding(relPath, 1, 'Manifest must contain aiUi metadata.', 'aiUi');
    return;
  }

  if (typeof aiUi.enabled !== 'boolean') {
    addFinding(relPath, 1, 'aiUi.enabled must be boolean.', String(aiUi.enabled));
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(aiUi.alias || '')) {
    addFinding(relPath, 1, 'aiUi.alias must be kebab-case.', String(aiUi.alias || ''));
  }
  ['title', 'category', 'summary', 'template', 'defaultSlot'].forEach((key) => {
    if (!isNonEmptyString(aiUi[key])) {
      addFinding(relPath, 1, `aiUi.${key} is required.`, JSON.stringify(aiUi[key]));
    }
  });
  if (typeof aiUi.preferred !== 'boolean') {
    addFinding(relPath, 1, 'aiUi.preferred must be boolean.', String(aiUi.preferred));
  }
  if (!isObject(aiUi.propsSchema)) {
    addFinding(relPath, 1, 'aiUi.propsSchema must be an object.', JSON.stringify(aiUi.propsSchema || {}));
  }
  if (!isObject(aiUi.slots) || Object.keys(aiUi.slots).length === 0) {
    addFinding(relPath, 1, 'aiUi.slots must be a non-empty object.', JSON.stringify(aiUi.slots || {}));
  }
  if (!Array.isArray(aiUi.allowedChildren)) {
    addFinding(relPath, 1, 'aiUi.allowedChildren must be an array.', JSON.stringify(aiUi.allowedChildren));
  }
  if (!isObject(aiUi.render) || !isNonEmptyString(aiUi.render.kind) || !isNonEmptyString(aiUi.render.template)) {
    addFinding(relPath, 1, 'aiUi.render.kind and aiUi.render.template are required.', JSON.stringify(aiUi.render || {}));
  }
  if (!isObject(aiUi.behavior)) {
    addFinding(relPath, 1, 'aiUi.behavior is required.', JSON.stringify(aiUi.behavior || {}));
  } else {
    if (!isNonEmptyString(aiUi.behavior.role)) {
      addFinding(relPath, 1, 'aiUi.behavior.role is required.', JSON.stringify(aiUi.behavior.role));
    }
    if (!Array.isArray(aiUi.behavior.events)) {
      addFinding(relPath, 1, 'aiUi.behavior.events must be an array.', JSON.stringify(aiUi.behavior.events));
    }
    if (!Array.isArray(aiUi.behavior.targetActions)) {
      addFinding(relPath, 1, 'aiUi.behavior.targetActions must be an array.', JSON.stringify(aiUi.behavior.targetActions));
    }
    if (!isObject(aiUi.behavior.intentMap)) {
      addFinding(relPath, 1, 'aiUi.behavior.intentMap must be an object.', JSON.stringify(aiUi.behavior.intentMap));
    }
    if (!isNonEmptyString(aiUi.behavior.eventTargetSelector)) {
      addFinding(relPath, 1, 'aiUi.behavior.eventTargetSelector is required.', JSON.stringify(aiUi.behavior.eventTargetSelector));
    }
  }
  if (!isObject(aiUi.style)) {
    addFinding(relPath, 1, 'aiUi.style is required.', JSON.stringify(aiUi.style || {}));
  } else {
    ['surfaceAware', 'supportsVariant', 'supportsSize', 'supportsTone'].forEach((key) => {
      if (typeof aiUi.style[key] !== 'boolean') {
        addFinding(relPath, 1, `aiUi.style.${key} must be boolean.`, JSON.stringify(aiUi.style[key]));
      }
    });
  }
  if (!isObject(aiUi.textTargets)) {
    addFinding(relPath, 1, 'aiUi.textTargets must be an object.', JSON.stringify(aiUi.textTargets || {}));
  }

  if (component?.type === 'II' && !(dependencies?.runtime || []).includes('EventBus')) {
    addFinding(relPath, 1, 'Type II components must declare EventBus in dependencies.runtime.', JSON.stringify(dependencies?.runtime || []));
  }
}

function validateComponentManifests() {
  const schemaPath = join(ROOT, COMPONENT_SCHEMA);
  if (!existsSync(schemaPath)) {
    addFinding(COMPONENT_SCHEMA, 1, 'Missing component manifest schema.', COMPONENT_SCHEMA);
    return;
  }

  try {
    JSON.parse(readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    addFinding(COMPONENT_SCHEMA, 1, 'Component manifest schema must be valid JSON.', error.message);
  }

  const componentsRoot = join(ROOT, COMPONENTS_DIR);
  if (!existsSync(componentsRoot)) {
    return;
  }

  const initSource = existsSync(join(ROOT, UI_INIT)) ? readFileSync(join(ROOT, UI_INIT), 'utf8') : '';
  const indexSource = existsSync(join(ROOT, COMPONENT_INDEX)) ? readFileSync(join(ROOT, COMPONENT_INDEX), 'utf8') : '';

  readdirSync(componentsRoot).forEach((entry) => {
    const componentRoot = join(componentsRoot, entry);
    if (!statSync(componentRoot).isDirectory()) {
      return;
    }

    const relRoot = relative(ROOT, componentRoot);
    const cssPath = join(componentRoot, `${entry}.css`);
    const jsPath = join(componentRoot, `${entry}.js`);
    const demoPath = join(componentRoot, `${entry}.demo.html`);
    const manifestPath = join(componentRoot, 'manifest.json');

    // Skip plan-only stub directories (design notes, no component files yet).
    if (!existsSync(cssPath) && !existsSync(jsPath) && !existsSync(manifestPath)) {
      return;
    }

    if (!existsSync(manifestPath)) {
      addFinding(relRoot, 1, 'Component is missing manifest.json.', 'manifest.json');
      return;
    }

    if (!existsSync(cssPath)) {
      addFinding(relRoot, 1, 'Component is missing its CSS file.', `${entry}.css`);
    }
    if (!existsSync(demoPath)) {
      addFinding(relRoot, 1, 'Component is missing its demo file.', `${entry}.demo.html`);
    }
    if (!indexSource.includes(`@import './${entry}/${entry}.css';`)) {
      addFinding(COMPONENT_INDEX, 1, 'Component CSS file is missing from src/ui/components/index.css.', `${entry}/${entry}.css`);
    }

    const relManifestPath = relative(ROOT, manifestPath);
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      addFinding(relManifestPath, 1, 'manifest.json must be valid JSON.', error.message);
      return;
    }

    validateManifestShape(manifest, relManifestPath);

    if (existsSync(cssPath)) {
      const cssSource = readFileSync(cssPath, 'utf8');
      const cssFindings = validateInteractiveComponentCss(
        manifest,
        cssSource,
        relative(ROOT, cssPath)
      );
      cssFindings.forEach((finding) => addFinding(finding.file, finding.line, finding.message, finding.sample));

      if (/#(?:[0-9a-fA-F]{3,8})\b|(?:rgb|hsl)a?\(/.test(cssSource)) {
        addFinding(relative(ROOT, cssPath), 1, 'Component CSS must use design tokens instead of raw color values.', 'raw color value detected');
      }
    }

    if (existsSync(demoPath)) {
      const demoSource = readFileSync(demoPath, 'utf8');
      if (!demoSource.includes(entry)) {
        addFinding(relative(ROOT, demoPath), 1, 'Component demo should reference the component name for manifest/demo parity.', entry);
      }
    }

    if (manifest?.component?.type === 'II') {
      if (!existsSync(jsPath)) {
        addFinding(relRoot, 1, 'Type II component is missing its JS lifecycle file.', `${entry}.js`);
      }
      const pascal = entry
        .split('-')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join('');
      const importNeedle = `./components/${entry}/${entry}.js`;
      const initNeedle = `init${pascal}System(eventBus)`;
      if (!initSource.includes(importNeedle) || !initSource.includes(initNeedle)) {
        addFinding(UI_INIT, 1, 'Type II component is not registered in src/ui/init.js.', `${entry}/${entry}.js`);
      }
    }
  });
}

function getComponentAliases() {
  const componentsRoot = join(ROOT, COMPONENTS_DIR);
  if (!existsSync(componentsRoot)) {
    return [];
  }

  return readdirSync(componentsRoot)
    .filter((entry) => statSync(join(componentsRoot, entry)).isDirectory())
    .sort((a, b) => a.localeCompare(b));
}

async function validateGeneratedArtifact(relPath, collectFn, command) {
  const outputPath = join(ROOT, relPath);
  if (!existsSync(outputPath)) {
    addFinding(relPath, 1, `Missing generated artifact. Run ${command}.`, relPath);
    return;
  }

  let current;
  try {
    current = JSON.parse(readFileSync(outputPath, 'utf8'));
  } catch (error) {
    addFinding(relPath, 1, 'Generated artifact must be valid JSON.', error.message);
    return;
  }

  const generatedAt = current.generatedAt || '2026-04-10T00:00:00.000Z';
  const expected = await collectFn({ generatedAt });
  const expectedSource = JSON.stringify(expected, null, 2) + '\n';
  const actualSource = readFileSync(outputPath, 'utf8');
  if (actualSource !== expectedSource) {
    addFinding(relPath, 1, `Generated artifact is stale. Run ${command}.`, relPath);
  }
}

async function main() {
  walk(ROOT);
  validateThemeContract();
  validateAppStyles();
  validateComponentIndex();
  validatePatternIndex();
  validateComponentManifests();
  await validateGeneratedArtifact(GENERATED_COMPONENT_REFERENCE, collectComponentReference, 'npm run generate-component-reference');
  await validateGeneratedArtifact(GENERATED_TOKEN_REFERENCE, collectTokenReference, 'npm run generate-token-reference');

  if (findings.length > 0) {
    console.error('\nStyle guard failed. Remove legacy patterns before committing:');
    findings.forEach((finding) => {
      console.error(`- ${finding.message}\n  ${finding.file}:${finding.line} → ${finding.sample}`);
    });
    process.exit(1);
  }

  console.log('Style guard passed ✓');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
