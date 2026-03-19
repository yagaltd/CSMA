#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.factory', 'platforms']);
const WHITELIST_FILES = new Set(['scripts/check-styles.js']);
const ALLOWED_EXTENSIONS = new Set(['.css', '.scss', '.js', '.ts', '.tsx', '.jsx', '.html', '.md', '.json']);
const MAIN_CSS = 'src/css/main.css';
const THEME_CSS = 'src/css/theme.css';
const COMPONENTS_DIR = 'src/ui/components';
const COMPONENT_INDEX = 'src/ui/components/index.css';
const PATTERNS_DIR = 'src/ui/patterns';
const PATTERN_INDEX = 'src/ui/patterns/index.css';

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
    appliesTo: (filePath) => filePath.startsWith('src/') || filePath === 'index.html'
  },
  {
    regex: /foundation\/tokens\.css|foundation\/themes\/light\.css|foundation\/themes\/dark\.css/,
    message: 'Import the theme contract via src/css/theme.css rather than raw foundation theme files.',
    appliesTo: (filePath) =>
      filePath.startsWith('src/') &&
      !filePath.endsWith('.md') &&
      !new Set([MAIN_CSS, THEME_CSS]).has(filePath)
  },
  {
    regex: /--fx-[\w-]+|--spacing-[\w-]+|--corner-[\w-]+/,
    message: 'Legacy token family detected (use semantic, scale, or recipe tokens from src/css/theme.css).',
    appliesTo: (filePath) =>
      filePath.startsWith('src/') &&
      !filePath.endsWith('.md') &&
      !new Set([THEME_CSS]).has(filePath)
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
  const themePath = join(ROOT, THEME_CSS);
  const mainPath = join(ROOT, MAIN_CSS);

  if (!existsSync(themePath)) {
    addFinding(THEME_CSS, 1, 'Missing canonical theme contract file.', THEME_CSS);
    return;
  }

  const mainCss = readFileSync(mainPath, 'utf8');
  if (!mainCss.includes("@import './theme.css';")) {
    addFinding(MAIN_CSS, 1, 'main.css must import src/css/theme.css.', '@import "./theme.css";');
  }
  if (!mainCss.includes("@import '../ui/components/index.css';")) {
    addFinding(MAIN_CSS, 1, 'main.css must import src/ui/components/index.css.', "@import '../ui/components/index.css';");
  }
  if (!mainCss.includes("@import '../ui/patterns/index.css';")) {
    addFinding(MAIN_CSS, 1, 'main.css must import src/ui/patterns/index.css after the component bundle.', "@import '../ui/patterns/index.css';");
  }

  ['foundation/tokens.css', 'foundation/themes/light.css', 'foundation/themes/dark.css'].forEach((deprecatedImport) => {
    if (mainCss.includes(deprecatedImport)) {
      addFinding(MAIN_CSS, 1, 'main.css still imports deprecated raw foundation theme files.', deprecatedImport);
    }
  });

  const themeCss = readFileSync(themePath, 'utf8');
  if (!themeCss.includes("@import './foundation/themes/light.css';")) {
    addFinding(THEME_CSS, 1, 'theme.css must import the light theme partial.', '@import "./foundation/themes/light.css";');
  }
  if (!themeCss.includes("@import './foundation/themes/dark.css';")) {
    addFinding(THEME_CSS, 1, 'theme.css must import the dark theme partial.', '@import "./foundation/themes/dark.css";');
  }
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

walk(ROOT);
validateThemeContract();
validateComponentIndex();
validatePatternIndex();

if (findings.length > 0) {
  console.error('\nStyle guard failed. Remove legacy patterns before committing:');
  findings.forEach((finding) => {
    console.error(`- ${finding.message}\n  ${finding.file}:${finding.line} → ${finding.sample}`);
  });
  process.exit(1);
}

console.log('Style guard passed ✓');
