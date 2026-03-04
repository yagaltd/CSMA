#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.factory', 'platforms']);
const WHITELIST_FILES = new Set(['scripts/check-styles.js']);
const ALLOWED_EXTENSIONS = new Set(['.css', '.scss', '.js', '.ts', '.tsx', '.jsx', '.html', '.md', '.json']);

const RULES = [
  { regex: /\.btn\b/, message: 'Legacy .btn class detected (use foundation .button component).' },
  { regex: /--color-[\w-]+/, message: 'Legacy --color-* token detected (use --fx-* tokens).' },
  { regex: /css\/theme\.css/, message: 'Reference to removed theme.css file detected.' }
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

walk(ROOT);

if (findings.length > 0) {
  console.error('\nStyle guard failed. Remove legacy patterns before committing:');
  findings.forEach((finding) => {
    console.error(`- ${finding.message}\n  ${finding.file}:${finding.line} → ${finding.sample}`);
  });
  process.exit(1);
}

console.log('Style guard passed ✓');
