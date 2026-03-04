#!/usr/bin/env node

/**
 * CSMA Mobile Build Script
 * Builds the main CSMA web app and syncs it into the Capacitor shell.
 *
 * Non-destructive behavior:
 * - Does not rewrite capacitor.config.json
 * - Does not auto-add android/ios platforms
 */

import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const MOBILE_DIR = join(ROOT_DIR, 'platforms', 'mobile-capacitor');
const DIST_DIR = join(ROOT_DIR, 'dist');
const WWW_DIR = join(MOBILE_DIR, 'www');
const CAP_CONFIG_PATH = join(MOBILE_DIR, 'capacitor.config.json');

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

console.log('🚀 Starting CSMA mobile build...');

try {
  run('npx cap --version', ROOT_DIR, 'pipe');
} catch {
  console.error('❌ Capacitor CLI not found. Install with: npm install -g @capacitor/cli');
  process.exit(1);
}

if (!existsSync(MOBILE_DIR)) {
  console.error('❌ Missing platform directory: platforms/mobile-capacitor');
  console.error('   Expected this directory to be present in the template.');
  process.exit(1);
}

if (!existsSync(CAP_CONFIG_PATH)) {
  console.error('❌ Missing capacitor config: platforms/mobile-capacitor/capacitor.config.json');
  console.error('   Create/init Capacitor once, then re-run this script.');
  process.exit(1);
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

console.log('📋 Syncing dist/ to platforms/mobile-capacitor/www ...');
try {
  rmSync(WWW_DIR, { recursive: true, force: true });
  mkdirSync(WWW_DIR, { recursive: true });
  copyDirectoryContents(DIST_DIR, WWW_DIR);
  console.log('✅ Web build synced to mobile www/');
} catch (error) {
  console.error('❌ Failed to sync dist -> www:', error.message);
  process.exit(1);
}

const hasAndroid = existsSync(join(MOBILE_DIR, 'android'));
const hasIos = existsSync(join(MOBILE_DIR, 'ios'));

if (hasAndroid || hasIos) {
  try {
    console.log('🔄 Running npx cap sync for existing native platforms...');
    run('npx cap sync', MOBILE_DIR);
    console.log('✅ Capacitor sync completed');
  } catch (error) {
    console.warn('⚠️  cap sync failed:', error.message);
    console.warn('   You can run npx cap sync manually inside platforms/mobile-capacitor.');
  }
} else {
  console.log('ℹ️  No native platforms detected (android/ios not present).');
  console.log('   Add one when ready:');
  console.log('   cd platforms/mobile-capacitor && npx cap add android');
  console.log('   cd platforms/mobile-capacitor && npx cap add ios');
}

console.log('');
console.log('🎉 Mobile build completed');
console.log('Next steps:');
console.log('1. cd platforms/mobile-capacitor');
console.log('2. npx cap open android   # or ios');
console.log('');
