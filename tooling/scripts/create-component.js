#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const COMPONENTS_DIR = path.join(ROOT, 'library', 'ui', 'components');
const COMPONENT_INDEX = path.join(COMPONENTS_DIR, 'index.css');
const UI_INIT = path.join(ROOT, 'library', 'ui', 'init.js');

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
  const renderKind = isTypeTwo ? 'template' : 'inline';
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
    throw new Error(`Component directory already exists: library/ui/components/${name}. Pass --force to overwrite files.`);
  }

  mkdirSync(componentDir, { recursive: true });

  const cssPath = path.join(componentDir, `${name}.css`);
  const demoPath = path.join(componentDir, `${name}.demo.html`);
  const manifestPath = path.join(componentDir, 'manifest.json');

  ensureFile(cssPath, componentCssTemplate(name, title), options.force);
  ensureFile(demoPath, componentDemoTemplate(name, title, type), options.force);
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
  console.log(`- Files: library/ui/components/${name}/`);
  console.log(`- CSS import ${cssImported ? 'added' : 'already present'} in library/ui/components/index.css`);
  if (type === 'II') {
    console.log(`- JS file created: ${jsCreated ? 'yes' : 'no'}`);
    console.log(`- initUI registration ${initRegistered ? 'added' : 'already present'} in library/ui/init.js`);
  }
  console.log('- Next steps: fill manifest details, implement states, add contracts if needed, add tests, then run npm run generate-ai-catalog.');
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
