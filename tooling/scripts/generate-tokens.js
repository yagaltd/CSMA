#!/usr/bin/env node
/**
 * CSMA Design Token Generator (DTCG-compliant)
 * Reads canonical src/style/design-tokens.json and generates CSS custom properties.
 *
 * Usage: node tooling/scripts/generate-tokens.js [--out path/to/tokens.css]
 * Default output: src/generated/tokens.css
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const TOKENS_PATH = join(ROOT, 'src', 'style', 'design-tokens.json');

function parseOutArg(argv) {
  const outIndex = argv.indexOf('--out');
  if (outIndex >= 0 && argv[outIndex + 1]) {
    return join(ROOT, argv[outIndex + 1]);
  }
  return join(ROOT, 'src', 'generated', 'tokens.css');
}

const OUTPUT_PATH = parseOutArg(process.argv.slice(2));

// Helper: Convert camelCase to kebab-case
function toKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// Helper: Check if an object is a DTCG token (has $value)
function isToken(obj) {
  return obj && typeof obj === 'object' && '$value' in obj && !('$type' in obj && Object.keys(obj).length === 1);
}

// Helper: Get entries from a token group, filtering out DTCG metadata keys ($type, $description, etc.)
function tokenEntries(obj) {
  return Object.entries(obj).filter(([key]) => !key.startsWith('$'));
}

// Helper: Resolve a DTCG reference like {primitives.spacing.sm} to the actual token
function resolveReference(ref, tokens) {
  if (typeof ref !== 'string' || !ref.startsWith('{') || !ref.endsWith('}')) {
    return null;
  }
  const path = ref.slice(1, -1).split('.');
  let current = tokens;
  for (const segment of path) {
    if (!current || typeof current !== 'object') return null;
    current = current[segment];
  }
  return isToken(current) ? current : null;
}

// Helper: Get the CSS variable name for a DTCG reference path
function referenceToCSSVar(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('{') || !ref.endsWith('}')) {
    return null;
  }
  const path = ref.slice(1, -1).split('.');
  if (path[0] === 'primitives') {
    const rest = path.slice(1);
    return resolvePrimitiveCSSVar(rest);
  }
  if (path[0] === 'semantic') {
    const rest = path.slice(1);
    return resolveSemanticCSSVar(rest);
  }
  return null;
}

// Map primitive token paths to CSS variable names
const PRIMITIVE_CSS_MAP = {
  spacing: (segments) => `--space-${segments[0]}`,
  radius: (segments) => `--radius-${segments[0]}`,
  shadow: (segments) => `--shadow-${segments[0]}`,
  breakpoint: (segments) => `--breakpoint-${segments[0]}`,
  zIndex: (segments) => `--z-${segments[0]}`,
  typography: (segments) => {
    const [group, ...rest] = segments;
    if (group === 'fontFamily') return `--font-family-${toKebab(rest[0])}`;
    if (group === 'fontSize') return `--font-size-${rest[0]}`;
    if (group === 'fontWeight') return `--font-weight-${toKebab(rest[0])}`;
    if (group === 'lineHeight') return `--line-height-${toKebab(rest[0])}`;
    return null;
  },
  motion: (segments) => {
    const [group, ...rest] = segments;
    if (group === 'duration') return `--motion-duration-${rest[0]}`;
    if (group === 'easing') return `--ease-${toKebab(rest[0])}`;
    return null;
  },
  opacity: (segments) => `--opacity-${segments[0]}`,
  letterSpacing: (segments) => `--tracking-${segments[0]}`,
  borderWidth: (segments) => `--border-width-${segments[0]}`,
  focusRing: (segments) => `--ring-${toKebab(segments[0])}`,
  layout: (segments) => `--layout-${toKebab(segments[0])}`,
};

function resolvePrimitiveCSSVar(segments) {
  const [group, ...rest] = segments;
  const mapper = PRIMITIVE_CSS_MAP[group];
  return mapper ? mapper(rest) : null;
}

// Map semantic token paths to CSS variable names
const SEMANTIC_CSS_MAP = {
  transition: (segments) => `--transition-${segments[0]}`,
  shadow: (segments) => `--shadow-${segments[0]}`,
};

function resolveSemanticCSSVar(segments) {
  const [group, ...rest] = segments;
  const mapper = SEMANTIC_CSS_MAP[group];
  return mapper ? mapper(rest) : null;
}

// Helper: Convert a DTCG token value to CSS string
function tokenValueToCSS(token, tokens) {
  const raw = token.$value;
  const type = token.$type;

  if (typeof raw === 'string') {
    if (raw.startsWith('{') && raw.endsWith('}')) {
      const cssVar = referenceToCSSVar(raw);
      return cssVar ? `var(${cssVar})` : raw;
    }
    return raw;
  }

  if (Array.isArray(raw)) {
    if (type === 'cubicBezier') {
      return `cubic-bezier(${raw.join(', ')})`;
    }
    if (type === 'shadow') {
      const toShadow = (s) => `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`;
      return raw.map(toShadow).join(', ');
    }
    return raw.join(', ');
  }

  if (typeof raw === 'object' && raw !== null) {
    if (type === 'color' && raw.colorSpace && raw.components) {
      const [a, b, c] = raw.components;
      if (raw.colorSpace === 'oklch') return `oklch(${a} ${b} ${c})`;
      if (raw.colorSpace === 'srgb') return `rgb(${Math.round(a * 255)} ${Math.round(b * 255)} ${Math.round(c * 255)})`;
      if (raw.colorSpace === 'hsl') return `hsl(${a} ${b}% ${c}%)`;
      return `color(${raw.colorSpace} ${raw.components.join(' ')})`;
    }
    if (type === 'transition') {
      const duration = raw.duration ? resolveToCSS(raw.duration, tokens) : '0ms';
      const timing = raw.timingFunction ? resolveToCSS(raw.timingFunction, tokens) : 'ease';
      return `${duration} ${timing}`;
    }
    if (type === 'shadow') {
      const toShadow = (s) => `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`;
      return Array.isArray(raw) ? raw.map(toShadow).join(', ') : toShadow(raw);
    }
    if (type === 'duration' && typeof raw === 'object' && 'value' in raw) {
      return `${raw.value}${raw.unit}`;
    }
    return JSON.stringify(raw);
  }

  if (typeof raw === 'number') {
    return String(raw);
  }

  return String(raw);
}

// Helper: Resolve a value that might be a DTCG reference to CSS
function resolveToCSS(val, tokens) {
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    const cssVar = referenceToCSSVar(val);
    return cssVar ? `var(${cssVar})` : val;
  }
  return val;
}

// Read tokens
const tokens = JSON.parse(readFileSync(TOKENS_PATH, 'utf-8'));

// Generate CSS
let css = `/**
 * CSMA Design Tokens - AUTO-GENERATED
 * Do not edit this file directly. Update src/style/design-tokens.json instead.
 * Generated: ${new Date().toISOString()}
 */

:root {
  /* ===================================
     PRIMITIVE TOKENS
     =================================== */

  /* Spacing — 4pt base with 8pt alignment */
`;

// Spacing
for (const [name, token] of tokenEntries(tokens.primitives.spacing)) {
  css += `  --space-${name}: ${token.$value};\n`;
}

css += '\n  /* Typography */\n';
for (const [name, token] of tokenEntries(tokens.primitives.typography.fontFamily)) {
  css += `  --font-family-${toKebab(name)}: ${token.$value};\n`;
}
for (const [name, token] of tokenEntries(tokens.primitives.typography.fontSize)) {
  css += `  --font-size-${name}: ${token.$value};\n`;
}
for (const [name, token] of tokenEntries(tokens.primitives.typography.fontWeight)) {
  css += `  --font-weight-${toKebab(name)}: ${token.$value};\n`;
}
for (const [name, token] of tokenEntries(tokens.primitives.typography.lineHeight)) {
  css += `  --line-height-${toKebab(name)}: ${token.$value};\n`;
}

css += '\n  /* Border Radius */\n';
for (const [name, token] of tokenEntries(tokens.primitives.radius)) {
  css += `  --radius-${name}: ${token.$value};\n`;
}

css += '\n  /* Shadows — Dual-layer (Tailwind-style) */\n';
for (const [name, token] of tokenEntries(tokens.primitives.shadow)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  --shadow-${name}: ${cssVal};\n`;
}

css += '\n  /* Motion */\n';
for (const [name, token] of tokenEntries(tokens.primitives.motion.duration)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  --motion-duration-${name}: ${cssVal};\n`;
}
for (const [name, token] of tokenEntries(tokens.primitives.motion.easing)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  --ease-${toKebab(name)}: ${cssVal};\n`;
}

css += '\n  /* Breakpoints */\n';
for (const [name, token] of tokenEntries(tokens.primitives.breakpoint)) {
  css += `  --breakpoint-${name}: ${token.$value};\n`;
}

css += '\n  /* Z-Index Layers */\n';
for (const [name, token] of tokenEntries(tokens.primitives.zIndex)) {
  css += `  --z-${name}: ${token.$value};\n`;
}

css += '\n  /* Opacity */\n';
for (const [name, token] of tokenEntries(tokens.primitives.opacity)) {
  css += `  --opacity-${name}: ${token.$value};\n`;
}

css += '\n  /* Letter Spacing */\n';
for (const [name, token] of tokenEntries(tokens.primitives.letterSpacing)) {
  css += `  --tracking-${name}: ${token.$value};\n`;
}

css += '\n  /* Border Width */\n';
for (const [name, token] of tokenEntries(tokens.primitives.borderWidth)) {
  css += `  --border-width-${name}: ${token.$value};\n`;
}

css += '\n  /* Focus Ring */\n';
for (const [name, token] of tokenEntries(tokens.primitives.focusRing)) {
  const cssVarName = `--ring-${toKebab(name)}`;
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  ${cssVarName}: ${cssVal};\n`;
}

css += '\n  /* Layout — Container widths, sidebar, touch target, grid minimums */\n';
for (const [name, token] of tokenEntries(tokens.primitives.layout)) {
  css += `  --layout-${toKebab(name)}: ${token.$value};\n`;
}

// Semantic aliases
css += '\n  /* ===================================\n     SEMANTIC ALIASES\n     =================================== */\n\n';
css += '  /* Transitions */\n';
for (const [name, token] of tokenEntries(tokens.semantic.transition)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  --transition-${name}: ${cssVal};\n`;
}

// Component tokens
css += '\n  /* ===================================\n     COMPONENT TOKENS\n     =================================== */\n\n';
for (const [component, props] of tokenEntries(tokens.components)) {
  css += `  /* ${component.charAt(0).toUpperCase() + component.slice(1)} */\n`;
  for (const [prop, token] of tokenEntries(props)) {
    const cssVal = tokenValueToCSS(token, tokens);
    css += `  --${component}-${toKebab(prop)}: ${cssVal};\n`;
  }
  css += '\n';
}

css += '}\n\n';

// Light theme
const light = tokens.themes.light;
css += `/* ===================================\n   LIGHT THEME\n   =================================== */\n\n:root[data-theme="light"],\n:root:not([data-theme="dark"]) {\n  color-scheme: ${light.$colorScheme};\n`;
for (const [name, token] of tokenEntries(light.colors)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  --${toKebab(name)}: ${cssVal};\n`;
}
css += '\n  /* Semantic Aliases */\n';
css += '  --card: var(--surface);\n';
css += '  --card-foreground: var(--foreground);\n';
css += '  --popover: var(--surface);\n';
css += '  --popover-foreground: var(--foreground);\n';
css += '  --muted: var(--background-muted);\n';
css += '  --muted-foreground: var(--foreground-muted);\n';
css += '  --input: var(--border);\n';
css += '  --ring: var(--primary);\n';
css += '\n  /* Soft Color Variants */\n';
css += '  --primary-soft: color-mix(in srgb, var(--primary) 16%, transparent);\n';
css += '  --info-soft: color-mix(in srgb, var(--info) 12%, var(--surface) 88%);\n';
css += '  --success-soft: color-mix(in srgb, var(--success) 12%, var(--surface) 88%);\n';
css += '  --warning-soft: color-mix(in srgb, var(--warning) 14%, var(--surface) 86%);\n';
css += '  --destructive-soft: color-mix(in srgb, var(--destructive) 12%, var(--surface) 88%);\n';
css += '}\n\n';

// Dark theme
const dark = tokens.themes.dark;
css += `/* ===================================\n   DARK THEME\n   =================================== */\n\n:root[data-theme="dark"] {\n  color-scheme: ${dark.$colorScheme};\n`;
for (const [name, token] of tokenEntries(dark.colors)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `  --${toKebab(name)}: ${cssVal};\n`;
}
css += '\n  /* Semantic Aliases */\n';
css += '  --card: var(--surface);\n';
css += '  --card-foreground: var(--foreground);\n';
css += '  --popover: var(--surface);\n';
css += '  --popover-foreground: var(--foreground);\n';
css += '  --muted: var(--background-muted);\n';
css += '  --muted-foreground: var(--foreground-muted);\n';
css += '  --input: var(--border);\n';
css += '  --ring: var(--primary);\n';
css += '\n  /* Soft Color Variants */\n';
css += '  --primary-soft: color-mix(in srgb, var(--primary) 16%, transparent);\n';
css += '  --info-soft: color-mix(in srgb, var(--info) 12%, var(--surface) 88%);\n';
css += '  --success-soft: color-mix(in srgb, var(--success) 12%, var(--surface) 88%);\n';
css += '  --warning-soft: color-mix(in srgb, var(--warning) 14%, var(--surface) 86%);\n';
css += '  --destructive-soft: color-mix(in srgb, var(--destructive) 12%, var(--surface) 88%);\n';
css += '}\n\n';

// Additional themes
const THEME_NAMES = Object.keys(tokens.themes).filter(t => !['light', 'dark'].includes(t));
for (const themeName of THEME_NAMES) {
  const theme = tokens.themes[themeName];
  const colorScheme = theme.$extensions?.['com.csma.colorScheme'] || 'light';
  const label = themeName.replace(/-([a-z])/g, (_, c) => ' ' + c.toUpperCase()).replace(/^\w/, c => c.toUpperCase());
  css += `/* ===================================\n   ${label.toUpperCase()} THEME\n   =================================== */\n\n:root[data-theme="${themeName}"] {\n  color-scheme: ${colorScheme};\n`;
  for (const [name, token] of tokenEntries(theme.colors)) {
    const cssVal = tokenValueToCSS(token, tokens);
    css += `  --${toKebab(name)}: ${cssVal};\n`;
  }
  css += '\n  /* Semantic Aliases */\n';
  css += '  --card: var(--surface);\n';
  css += '  --card-foreground: var(--foreground);\n';
  css += '  --popover: var(--surface);\n';
  css += '  --popover-foreground: var(--foreground);\n';
  css += '  --muted: var(--background-muted);\n';
  css += '  --muted-foreground: var(--foreground-muted);\n';
  css += '  --input: var(--border);\n';
  css += '  --ring: var(--primary);\n';
  css += '\n  /* Soft Color Variants */\n';
  css += '  --primary-soft: color-mix(in srgb, var(--primary) 16%, transparent);\n';
  css += '  --info-soft: color-mix(in srgb, var(--info) 12%, var(--surface) 88%);\n';
  css += '  --success-soft: color-mix(in srgb, var(--success) 12%, var(--surface) 88%);\n';
  css += '  --warning-soft: color-mix(in srgb, var(--warning) 14%, var(--surface) 86%);\n';
  css += '  --destructive-soft: color-mix(in srgb, var(--destructive) 12%, var(--surface) 88%);\n';
  css += '}\n\n';
}

// prefers-color-scheme fallback
css += `
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    color-scheme: ${tokens.themes.dark.$colorScheme};
`;
for (const [name, token] of tokenEntries(tokens.themes.dark.colors)) {
  const cssVal = tokenValueToCSS(token, tokens);
  css += `    --${toKebab(name)}: ${cssVal};\n`;
}
css += `  }\n}\n`;

// Write output
console.log('CSMA Design Token Generator (DTCG)');
console.log('   Reading:', TOKENS_PATH);
console.log('   Validating tokens...');

try {
  const errors = validateTokens(tokens);
  if (errors.length > 0) {
    console.error('Token validation failed:');
    errors.forEach(err => console.error('   -', err));
    process.exit(1);
  }
  console.log('   Validation passed');

  const outputDir = dirname(OUTPUT_PATH);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  writeFileSync(OUTPUT_PATH, css);
  console.log('   Written:', OUTPUT_PATH);
  console.log('Tokens generated successfully!');
} catch (error) {
  console.error('Error generating tokens:', error.message);
  process.exit(1);
}

/**
 * Validate DTCG design tokens
 */
function validateTokens(tokens) {
  const errors = [];

  const requiredSections = ['primitives', 'semantic', 'components', 'themes'];
  requiredSections.forEach(section => {
    if (!tokens[section]) {
      errors.push(`Missing required section: ${section}`);
    }
  });

  if (!tokens.themes?.light || !tokens.themes?.dark) {
    errors.push('Missing required themes: light and dark');
  }

  if (tokens.primitives?.spacing) {
    for (const [name, token] of tokenEntries(tokens.primitives.spacing)) {
      if (!token.$value) {
        errors.push(`Spacing token "${name}" missing $value`);
      }
      if (typeof token.$value === 'string' && !token.$value.match(/^[\d.]+rem|^[\d.]+px|^var\(--/)) {
        errors.push(`Spacing token "${name}" has invalid value: ${token.$value}`);
      }
    }
  }

  ['light', 'dark'].forEach(theme => {
    if (tokens.themes?.[theme]?.colors) {
      for (const [name, token] of tokenEntries(tokens.themes[theme].colors)) {
        if (!token.$value) {
          errors.push(`Color token "${name}" in ${theme} theme missing $value`);
          continue;
        }
        if (typeof token.$value !== 'string') continue;
        const validColor = token.$value.match(/^(oklch|hsl|rgb|#|var\(--)/);
        if (!validColor) {
          errors.push(`Color token "${name}" in ${theme} has invalid format: ${token.$value}`);
        }
      }
    }
  });

  function checkTypes(obj, path = '') {
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('$') || key === 'colors') continue;
      if (isToken(val)) {
        if (!val.$type) {
          errors.push(`Token "${path}${path ? '.' : ''}${key}" missing $type`);
        }
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        checkTypes(val, `${path}${path ? '.' : ''}${key}`);
      }
    }
  }
  if (tokens.primitives) checkTypes(tokens.primitives, 'primitives');

  if (tokens.components) {
    for (const [component, props] of tokenEntries(tokens.components)) {
      for (const [prop, token] of tokenEntries(props)) {
        const raw = token.$value;
        if (typeof raw === 'string' && raw.startsWith('{') && raw.endsWith('}')) {
          const resolved = resolveReference(raw, tokens);
          if (!resolved) {
            errors.push(`Component token ${component}.${prop} has unresolvable reference: ${raw}`);
          }
        }
      }
    }
  }

  return errors;
}
