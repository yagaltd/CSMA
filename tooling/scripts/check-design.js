#!/usr/bin/env node

/**
 * check-design.js — Anti-pattern linting for CSMA pages and components.
 *
 * Hard-fail rules (exit 1): regex-checkable, binary, near-zero false positives.
 * Warnings (exit 0): printed to stderr but don't fail the build.
 *
 * Usage:
 *   node tooling/scripts/check-design.js            # check all HTML files
 *   node tooling/scripts/check-design.js demo/       # check specific paths
 *   npm run check:design
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.factory', 'platforms', 'generated']);

// ── Finding types ────────────────────────────────────────────────

const FAIL = 'fail';
const WARN = 'warn';

const findings = [];

function addFinding(file, ruleId, message, sample, severity) {
  findings.push({ file, ruleId, message, sample, severity });
}

// ── Hard-fail rules (binary, regex-checkable) ───────────────────

const HARD_RULES = [
  {
    id: 'em-dash',
    message: 'Em-dash in visible text (use hyphen, comma, colon, or period).',
    pattern: /[—–]/,
    appliesTo: (f) => f.endsWith('.html') || f.endsWith('.md'),
  },
  {
    id: 'italic-headers',
    message: 'Italic h1-h3 header (headers must be font-style: normal).',
    pattern: /h[1-3][^}]*font-style\s*:\s*italic|font-style\s*:\s*italic[^}]*h[1-3]/,
    appliesTo: (f) => f.endsWith('.css'),
  },
  {
    id: 'banned-serif',
    message: 'Banned serif font (Fraunces or Instrument Serif as default). Only allowed in comments.',
    pattern: /font-family\s*:[^;]*\b(Fraunces|Instrument[_ ]Serif)\b/,
    appliesTo: (f) => f.endsWith('.css'),
  },
  {
    id: 'section-number-eyebrow',
    message: 'Section-number eyebrow detected (00/, 001·, etc.).',
    // Match patterns like "01 /", "002 ·", "001·", "00 / INDEX"
    pattern: /\b\d{2,3}\s*(\/|·|—|–)\s*[A-Z]/,
    skip: (content, line) => /^\s*(\/\/|\/\*|\*)\s*/.test(line),
  },
  {
    id: 'scroll-cue',
    message: 'Scroll cue detected ("Scroll", "↓ scroll", "Scroll to explore").',
    pattern: /Scroll to explore|↓\s*scroll|↡|⌄.*scroll/i,
  },
  {
    id: 'version-label-hero',
    message: 'Version label in hero (v0.6, BETA, INVITE-ONLY).',
    checkContent: (content) => {
      const heroPattern = /class="[^"]*hero[^"]*"/g;
      let match;
      while ((match = heroPattern.exec(content)) !== null) {
        const heroStart = match.index;
        // Find the closing tag for the hero section
        const searchFrom = heroStart + match[0].length;
        const closeIdx = content.indexOf('</section>', searchFrom);
        const heroEnd = closeIdx > heroStart ? closeIdx : heroStart + 2000;
        const heroBlock = content.substring(heroStart, heroEnd);
        if (/\bv\d+\.\d+\b|\bBETA\b|\bINVITE-ONLY\b/i.test(heroBlock)) {
          return { fail: true, sample: `Version label in hero near line ${content.substring(0, heroStart).split('\n').length}` };
        }
      }
      return { fail: false };
    },
  },
  {
    id: 'decoration-text-strip',
    message: 'Decoration text strip ("BRAND. MOTION. SPATIAL." etc.).',
    pattern: /(?:[A-Z]{2,}\.\s+){2,}[A-Z]{2,}\./,
  },
  {
    id: 'locale-strip',
    message: 'Locale/time strip ("Lisbon 14:23 · 18°C" pattern).',
    pattern: /\d{1,2}:\d{2}\s*·\s*\d+°/,
  },
  {
    id: 're-drawn-chrome',
    message: 'Re-drawn chrome (fake browser bar, phone frame).',
    pattern: /class="[^"]*(?:browser-bar|phone-frame|fake-chrome|mock-browser|ide-window)[^"]*"/,
  },
  {
    id: 'gradient-text',
    message: 'Gradient text (background-clip: text + gradient).',
    pattern: /background-clip\s*:\s*text/,
    appliesTo: (f) => f.endsWith('.css'),
  },
  {
    id: 'hardcoded-color',
    message: 'Hard-coded hex color instead of design token var(--color-*).',
    pattern: /(?:color|background|border-color|fill|stroke)\s*:[^;]*#([0-9a-fA-F]{3,8})\b/,
    skip: (content, line) => /var\(--/.test(line) || /^\s*(\/\/|\/\*|\*)\s*/.test(line) || /node_modules/.test(line),
    appliesTo: (f) => f.endsWith('.css') || f.endsWith('.html'),
  },
  {
    id: 'data-loading',
    message: 'data-loading attribute (use data-state="loading" instead).',
    pattern: /data-loading=/,
    appliesTo: (f) => f.endsWith('.html') || f.endsWith('.css') || f.endsWith('.js'),
  },
  {
    id: 'hero-max-elements',
    message: 'Hero section has > 4 text elements.',
    checkContent: (content, filePath) => {
      // Find hero sections and count direct text-bearing children
      const heroPattern = /class="[^"]*hero[^"]*"/g;
      let match;
      while ((match = heroPattern.exec(content)) !== null) {
        const heroStart = match.index;
        const heroEnd = content.indexOf('</section>', heroStart) || content.indexOf('</div>', heroStart);
        const heroBlock = content.substring(heroStart, heroEnd > heroStart ? heroEnd : heroStart + 3000);
        // Count h1, h2, p, span, a elements
        const textElements = heroBlock.match(/<(?:h[1-6]|p|span|a)\b/g);
        if (textElements && textElements.length > 4) {
          return { fail: true, sample: `Hero has ${textElements.length} text elements` };
        }
      }
      return { fail: false };
    },
  },
];

// ── Warning rules (heuristic, possible false positives) ──────────

const WARN_RULES = [
  {
    id: 'generic-step-labels',
    message: 'Generic step labels ("Stage 1", "Step 01").',
    pattern: /\bStage\s+\d+\b|\bStep\s+0?\d+\b/i,
  },
  {
    id: 'pills-on-images',
    message: 'Pill/label overlaid on image (position: absolute inside an img container).',
    pattern: /class="[^"]*(?:pill|label|tag)[^"]*"[^>]*style="[^"]*position\s*:\s*absolute/i,
  },
  {
    id: 'quietly-trusted',
    message: '"Quietly in use at" / "Quietly trusted by" copy.',
    pattern: /Quietly\s+(in use|trusted)/i,
  },
  {
    id: 'performative-craftsman',
    message: 'Performative-craftsman label ("From the field", "Field notes").',
    pattern: /From the field|Field notes|Currently on the bench/i,
  },
  {
    id: 'startup-slop-names',
    message: 'Startup-slop brand names ("Jane Doe", "Acme Corp").',
    pattern: /\bJane Doe\b|\bAcme Corp(?:oration)?\b|\bJohn Smith\b/i,
  },
  {
    id: 'eyebrow-density',
    message: 'Too many eyebrows (> ceil(sections/3)).',
    checkContent: (content) => {
      const sectionCount = (content.match(/<section\b/g) || []).length;
      const eyebrowCount = (content.match(/class="[^"]*(?:eyebrow|overline|eyebrow-text)[^"]*"/g) || []).length;
      const maxEyebrows = Math.ceil(sectionCount / 3);
      if (sectionCount > 0 && eyebrowCount > maxEyebrows) {
        return { fail: true, sample: `${eyebrowCount} eyebrows in ${sectionCount} sections (max ${maxEyebrows})` };
      }
      return { fail: false };
    },
  },
];

// ── File discovery ───────────────────────────────────────────────

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (ext === '.html' || ext === '.css' || ext === '.js') {
        checkFile(fullPath);
      }
    }
  }
}

function checkFile(fullPath) {
  const relPath = relative(ROOT, fullPath);
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }

  const lines = content.split('\n');

  // Check hard rules
  for (const rule of HARD_RULES) {
    if (rule.appliesTo && !rule.appliesTo(relPath)) continue;

    if (rule.checkContent) {
      const result = rule.checkContent(content, relPath);
      if (result.fail) {
        addFinding(relPath, rule.id, rule.message, result.sample || '', FAIL);
      }
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (rule.skip && rule.skip(content, line)) continue;
      const match = line.match(rule.pattern);
      if (match) {
        addFinding(relPath, rule.id, rule.message, `Line ${i + 1}: ${match[0].substring(0, 80)}`, FAIL);
        break; // one finding per rule per file
      }
    }
  }

  // Check warning rules
  for (const rule of WARN_RULES) {
    if (rule.appliesTo && !rule.appliesTo(relPath)) continue;

    if (rule.checkContent) {
      const result = rule.checkContent(content);
      if (result.fail) {
        addFinding(relPath, rule.id, rule.message, result.sample, WARN);
      }
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (rule.skip && rule.skip(content, line)) continue;
      const match = line.match(rule.pattern);
      if (match) {
        addFinding(relPath, rule.id, rule.message, `Line ${i + 1}: ${match[0].substring(0, 80)}`, WARN);
        break;
      }
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  const targets = process.argv.slice(2);
  if (targets.length > 0) {
    for (const target of targets) {
      const fullPath = join(ROOT, target);
      if (!existsSync(fullPath)) {
        console.error(`Path not found: ${target}`);
        process.exit(1);
      }
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else {
        checkFile(fullPath);
      }
    }
  } else {
    // Default: check demo/ and frontend/ directories
    const defaultDirs = ['demo', 'frontend', 'src/ui'];
    for (const dir of defaultDirs) {
      const fullPath = join(ROOT, dir);
      if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
        walk(fullPath);
      }
    }
  }

  // Report
  const failures = findings.filter((f) => f.severity === FAIL);
  const warnings = findings.filter((f) => f.severity === WARN);

  if (warnings.length > 0) {
    console.error('\n⚠ Design warnings:');
    for (const w of warnings) {
      console.error(`  [${w.ruleId}] ${w.file}: ${w.message}`);
      console.error(`    ${w.sample}`);
    }
  }

  if (failures.length > 0) {
    console.error('\n✗ Design check failed:');
    for (const f of failures) {
      console.error(`  [${f.ruleId}] ${f.file}: ${f.message}`);
      console.error(`    ${f.sample}`);
    }
    console.error(`\n${failures.length} failure(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log(`\n✓ Design check passed with ${warnings.length} warning(s)`);
  } else {
    console.log('✓ Design check passed');
  }
}

main();
