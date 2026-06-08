#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
export const COMPONENTS_DIR = path.join(ROOT, 'src', 'ui', 'components');
const COMPONENT_INDEX = path.join(COMPONENTS_DIR, 'index.css');
export const UI_INIT = path.join(ROOT, 'src', 'ui', 'init.js');

function printHelp() {
  console.log(`Usage:
  node scripts/create-component.js --name <kebab-name> --type <I|II> [options]

Options:
  --name           Component name in kebab-case. Required.
  --type           Component type: I or II. Required.
  --description    Human-readable description.
  --category       AI UI category. Default: CSS-Only for Type I, Interactive for Type II.
  --owner          Component owner. Default: ui-service.
  --title          Display title. Default: derived from name.
  --force          Allow writing into an existing component directory.
  --help           Show this help.

Examples:
  node scripts/create-component.js --name accordion --type II --description "Accordion disclosure panels"
  node scripts/create-component.js --name stat-card --type I`);
}

function parseArgs(argv) {
  const options = {
    force: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument "${arg}"`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    options[key] = value;
    index += 1;
  }

  return options;
}

function ensureKebabName(name) {
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error('Component name must be kebab-case, for example "stat-card".');
  }
  return name;
}

function ensureType(type) {
  if (type !== 'I' && type !== 'II') {
    throw new Error('Component type must be "I" or "II".');
  }
  return type;
}

function toTitle(name) {
  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function toPascal(name) {
  return name
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function componentCssTemplate(name, title) {
  return `/* CSMA Component — ${title} */

.${name} {
  display: block;
}
`;
}

function componentDemoTemplate(name, title, type) {
  const behaviorNote = type === 'II'
    ? `\n    <p>Initialize with <code>init${toPascal(name)}System(eventBus)</code>.</p>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} Demo</title>
    <link rel="stylesheet" href="../../../style/main.css" />
    <style>
      .preview-states { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-lg); }
      .preview-state { display: flex; flex-direction: column; gap: var(--space-xs); }
      .preview-state__label { font-size: var(--font-size-xs); color: var(--foreground-muted); font-family: var(--font-family-mono); text-transform: uppercase; letter-spacing: 0.05em; }
    </style>
  </head>
  <body>
    <main class="stack" data-gap="lg">
      <h1>${title}</h1>
      <div class="${name}">${title}</div>${behaviorNote}
    </main>
  </body>
</html>
`;
}

function componentPreviewTemplate(name, title, type) {
  const isTypeII = type === 'II';
  const initNote = isTypeII
    ? `    <p class="preview-note">Type II component — initialize with <code>init${toPascal(name)}System(eventBus)</code> for interactive behavior.</p>\n`
    : '';

  // Build 8-state examples. States use data-state, data-variant, and standard HTML attributes.
  const states = [
    {
      id: 'default',
      label: 'Default',
      attrs: '',
      description: 'Resting state, no user interaction'
    },
    {
      id: 'hover',
      label: 'Hover',
      attrs: 'data-preview-hover',
      description: 'Mouse pointer over element (use [data-preview-hover] in CSS to simulate :hover)'
    },
    {
      id: 'active',
      label: 'Active / Pressed',
      attrs: 'data-preview-active',
      description: 'Element is being pressed'
    },
    {
      id: 'focus',
      label: 'Focus',
      attrs: 'data-preview-focus',
      description: 'Element has keyboard focus (use [data-preview-focus] to simulate :focus-visible)'
    },
    {
      id: 'disabled',
      label: 'Disabled',
      attrs: 'disabled',
      description: 'Element is non-interactive'
    },
    {
      id: 'loading',
      label: 'Loading',
      attrs: 'data-state="loading"',
      description: 'Async operation in progress'
    },
    {
      id: 'error',
      label: 'Error',
      attrs: 'aria-invalid="true"',
      description: 'Validation or operation error'
    },
    {
      id: 'selected',
      label: 'Selected',
      attrs: 'aria-pressed="true"',
      description: 'Toggle/toggleable element in selected state'
    }
  ];

  const stateCards = states.map(s => {
    const attrStr = s.attrs ? ` ${s.attrs}` : '';
    return `    <div class="preview-state" data-state-group="${s.id}">
      <span class="preview-state__label">${s.label}</span>
      <div class="${name}"${attrStr}>${title}</div>
      <span class="preview-state__desc">${s.description}</span>
    </div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} — 8-State Preview</title>
    <link rel="stylesheet" href="../../../style/main.css" />
    <style>
      /* Preview-only layout */
      .preview-page { max-width: 64rem; margin: 0 auto; padding: var(--space-xl); }
      .preview-header { margin-bottom: var(--space-xl); }
      .preview-header h1 { margin: 0 0 var(--space-xs) 0; }
      .preview-header p { margin: 0; color: var(--foreground-muted); }
      .preview-note { color: var(--foreground-muted); font-size: var(--font-size-sm); }
      .preview-note code { background: var(--muted); padding: 0.125em 0.375em; border-radius: var(--radius-sm); }

      .preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: var(--space-lg);
      }
      .preview-state {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--surface);
      }
      .preview-state__label {
        font-size: var(--font-size-xs);
        color: var(--foreground-muted);
        font-family: var(--font-family-mono);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: var(--space-2xs);
      }
      .preview-state__desc {
        font-size: var(--font-size-xs);
        color: var(--foreground-muted);
        line-height: var(--line-height-body);
      }

      /* Simulated states for preview — use these in your component CSS */
      /* [data-preview-hover] should match your :hover styles */
      /* [data-preview-active] should match your :active styles */
      /* [data-preview-focus] should match your :focus-visible styles */

      .preview-state:hover {
        border-color: var(--primary);
      }
    </style>
  </head>
  <body>
    <div class="preview-page">
      <header class="preview-header">
        <h1>${title} — 8-State Preview</h1>
        <p>All visual states for the <code>.${name}</code> component. Use this page to verify state styles are complete and consistent.</p>
${initNote}      </header>

      <section class="preview-grid">
${stateCards}
      </section>
    </div>
  </body>
</html>
`;
}

function componentJsTemplate(name, title) {
  const pascal = toPascal(name);
  return `/**
 * CSMA ${title} Component
 * Type II component with EventBus lifecycle.
 */

export function init${pascal}System(eventBus) {
  if (!eventBus) return () => {};

  const cleanups = [];

  // Subscribe to INTENT_* events here and push cleanup functions.
  // Example:
  // cleanups.push(eventBus.subscribe('INTENT_${name.toUpperCase().replace(/-/g, '_')}_OPEN', () => {}));

  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup?.());
}
`;
}

export function buildComponentManifestTemplate({ name, type, owner, title, description, category }) {
  const isTypeTwo = type === 'II';
  const renderKind = isTypeTwo ? 'template' : 'element';
  const template = isTypeTwo
    ? `<!-- ${title} is managed by init${toPascal(name)}System(eventBus) -->`
    : `<div class="${name}">${title}</div>`;

  return JSON.stringify({
    eccac: {
      version: '1.0.0',
      spec: '1.0.0'
    },
    component: {
      name,
      type,
      owner,
      lifecycle: 'draft',
      stability: 'experimental'
    },
    contracts: {
      published: [],
      subscribed: []
    },
    dependencies: {
      runtime: isTypeTwo ? ['EventBus'] : [],
      components: []
    },
    metadata: {
      description
    },
    aiUi: {
      enabled: true,
      alias: name,
      title,
      category,
      preferred: false,
      summary: description,
      template,
      propsSchema: {},
      defaultSlot: 'default',
      slots: {
        default: {
          selector: ':root',
          allowedChildren: []
        }
      },
      allowedChildren: [],
      render: {
        kind: renderKind,
        tag: 'div',
        className: name,
        textProp: 'label',
        template
      },
      behavior: {
        role: 'node',
        events: isTypeTwo ? ['click'] : [],
        targetActions: [],
        intentMap: {},
        fieldValue: null,
        eventTargetSelector: ':root'
      },
      style: {
        surfaceAware: true,
        supportsVariant: true,
        supportsSize: true,
        supportsTone: true
      },
      textTargets: {
        label: [`.${name}`]
      }
    }
  }, null, 2) + '\n';
}

function ensureFile(pathname, content, force) {
  if (existsSync(pathname) && !force) {
    throw new Error(`Refusing to overwrite existing file: ${path.relative(ROOT, pathname)}`);
  }
  writeFileSync(pathname, content, 'utf8');
}

function ensureCssImport(name) {
  const importLine = `@import './${name}/${name}.css';`;
  const current = readFileSync(COMPONENT_INDEX, 'utf8');
  if (current.includes(importLine)) {
    return false;
  }
  const next = current.trimEnd() + `\n${importLine}\n`;
  writeFileSync(COMPONENT_INDEX, next, 'utf8');
  return true;
}

function ensureInitRegistration(name) {
  const pascal = toPascal(name);
  const importLine = `import { init${pascal}System } from './components/${name}/${name}.js';`;
  const cleanupLine = `  cleanups.push(init${pascal}System(eventBus));`;
  let current = readFileSync(UI_INIT, 'utf8');
  let changed = false;

  if (!current.includes(importLine)) {
    const anchor = "import { initToastSystem } from './components/toast/toast.js';";
    if (!current.includes(anchor)) {
      throw new Error(`Could not find import anchor in ${path.relative(ROOT, UI_INIT)}`);
    }
    current = current.replace(anchor, `${anchor}\n${importLine}`);
    changed = true;
  }

  if (!current.includes(cleanupLine)) {
    const anchor = '  // Add your component init functions here:\n  // cleanups.push(initYourComponent(eventBus));';
    if (!current.includes(anchor)) {
      throw new Error(`Could not find cleanup anchor in ${path.relative(ROOT, UI_INIT)}`);
    }
    current = current.replace(anchor, `${cleanupLine}\n\n${anchor}`);
    changed = true;
  }

  if (changed) {
    writeFileSync(UI_INIT, current, 'utf8');
  }

  return changed;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const name = ensureKebabName(options.name);
  const type = ensureType(options.type);
  const title = options.title || toTitle(name);
  const description = options.description || `${title} component`;
  const owner = options.owner || 'ui-service';
  const category = options.category || (type === 'I' ? 'CSS-Only' : 'Interactive');

  const componentDir = path.join(COMPONENTS_DIR, name);
  if (existsSync(componentDir) && !options.force) {
    throw new Error(`Component directory already exists: src/ui/components/${name}. Pass --force to overwrite files.`);
  }

  mkdirSync(componentDir, { recursive: true });

  const cssPath = path.join(componentDir, `${name}.css`);
  const demoPath = path.join(componentDir, `${name}.demo.html`);
  const manifestPath = path.join(componentDir, 'manifest.json');

  const previewPath = path.join(componentDir, `${name}.preview.html`);

  ensureFile(cssPath, componentCssTemplate(name, title), options.force);
  ensureFile(demoPath, componentDemoTemplate(name, title, type), options.force);
  ensureFile(previewPath, componentPreviewTemplate(name, title, type), options.force);
  ensureFile(manifestPath, buildComponentManifestTemplate({ name, type, owner, title, description, category }), options.force);

  let jsCreated = false;
  if (type === 'II') {
    const jsPath = path.join(componentDir, `${name}.js`);
    ensureFile(jsPath, componentJsTemplate(name, title), options.force);
    jsCreated = true;
  }

  const cssImported = ensureCssImport(name);
  const initRegistered = type === 'II' ? ensureInitRegistration(name) : false;

  console.log(`Created component scaffold for "${name}" (${type}).`);
  console.log(`- Files: src/ui/components/${name}/`);
  console.log(`  - ${name}.css`);
  console.log(`  - ${name}.demo.html`);
  console.log(`  - ${name}.preview.html (8-state visual preview)`);
  console.log(`  - manifest.json`);
  console.log(`- CSS import ${cssImported ? 'added' : 'already present'} in src/ui/components/index.css`);
  if (type === 'II') {
    console.log(`- JS file created: ${jsCreated ? 'yes' : 'no'}`);
    console.log(`- initUI registration ${initRegistered ? 'added' : 'already present'} in src/ui/init.js`);
  }
  console.log('- Next steps: fill manifest details, implement states, add contracts if needed, add tests.');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`[create-component] ${error.message}`);
    process.exit(1);
  }
}
