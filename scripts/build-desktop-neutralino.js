#!/usr/bin/env node

/**
 * CSMA Desktop Build Script
 * Builds the main CSMA web app and syncs it into the Neutralino shell.
 *
 * Non-destructive behavior:
 * - Does not rewrite neutralino.config.json
 * - Preserves Neutralino client library (neutralino.js) if present
 */

import { execSync } from 'child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const DESKTOP_DIR = join(ROOT_DIR, 'platforms', 'desktop-neutralino');
const DIST_DIR = join(ROOT_DIR, 'dist');
const RESOURCES_DIR = join(DESKTOP_DIR, 'resources');
const NEUTRALINO_CONFIG_PATH = join(DESKTOP_DIR, 'neutralino.config.json');

function run(command, cwd = ROOT_DIR, stdio = 'inherit') {
  execSync(command, { cwd, stdio });
}

function copyDirectoryContents(sourceDir, targetDir) {
  const entries = readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(sourceDir, entry.name);
    const dst = join(targetDir, entry.name);
    cpSync(src, dst, { recursive: true, force: true });
  }
}

console.log('🖥️  Starting CSMA desktop build...');

try {
  run('neu version', ROOT_DIR, 'pipe');
} catch {
  console.error('❌ Neutralino CLI not found. Install with: npm install -g @neutralinojs/neu');
  process.exit(1);
}

if (!existsSync(DESKTOP_DIR)) {
  console.error('❌ Missing platform directory: platforms/desktop-neutralino');
  process.exit(1);
}

if (!existsSync(NEUTRALINO_CONFIG_PATH)) {
  console.error('❌ Missing Neutralino config: platforms/desktop-neutralino/neutralino.config.json');
  process.exit(1);
}

let neutralinoClientPath = join(RESOURCES_DIR, 'js', 'neutralino.js');
let neutralinoClientSource = null;

try {
  const config = JSON.parse(readFileSync(NEUTRALINO_CONFIG_PATH, 'utf8'));
  const configuredClient = config?.cli?.clientLibrary;
  if (typeof configuredClient === 'string' && configuredClient.trim()) {
    const relativeClient = configuredClient.replace(/^\/+/, '');
    neutralinoClientPath = join(DESKTOP_DIR, relativeClient);
  }
} catch {
  console.warn('⚠️  Could not parse neutralino.config.json; using default client path');
}

if (existsSync(neutralinoClientPath)) {
  neutralinoClientSource = readFileSync(neutralinoClientPath);
}

console.log('📦 Building main CSMA app (not examples/todo-app)...');
try {
  run('npm run build');
  console.log('✅ Web build completed');
} catch (error) {
  console.error('❌ Web build failed:', error.message);
  process.exit(1);
}

if (!existsSync(DIST_DIR)) {
  console.error('❌ dist/ not found after build');
  process.exit(1);
}

console.log('📋 Syncing dist/ to platforms/desktop-neutralino/resources ...');
try {
  rmSync(RESOURCES_DIR, { recursive: true, force: true });
  mkdirSync(RESOURCES_DIR, { recursive: true });
  copyDirectoryContents(DIST_DIR, RESOURCES_DIR);

  if (neutralinoClientSource) {
    const clientDir = dirname(neutralinoClientPath);
    mkdirSync(clientDir, { recursive: true });
    writeFileSync(neutralinoClientPath, neutralinoClientSource);
    console.log('✅ Preserved Neutralino client library:', neutralinoClientPath.replace(`${ROOT_DIR}/`, ''));
  } else {
    console.warn('⚠️  neutralino.js was not found before sync.');
    console.warn('   Run "neu update" in platforms/desktop-neutralino if needed.');
  }

  console.log('✅ Web build synced to desktop resources/');
} catch (error) {
  console.error('❌ Failed to sync dist -> resources:', error.message);
  process.exit(1);
}

console.log('');
console.log('🎉 Desktop build completed');
console.log('Next steps:');
console.log('1. cd platforms/desktop-neutralino');
console.log('2. neu run');
console.log('3. neu build --release');
console.log('');
