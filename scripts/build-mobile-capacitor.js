#!/usr/bin/env node

/**
 * CSMA Mobile Build Script
 * Builds web app and syncs with Capacitor for mobile deployment
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const PLATFORMS_DIR = join(ROOT_DIR, 'platforms');
const MOBILE_DIR = join(PLATFORMS_DIR, 'mobile-capacitor');

console.log('🚀 Starting CSMA mobile build...');

// Check if Capacitor CLI is installed
try {
    execSync('npx cap --version', { stdio: 'pipe' });
} catch (error) {
    console.error('❌ Capacitor CLI not found. Install with: npm install -g @capacitor/cli');
    process.exit(1);
}

// Step 1: Build web app
console.log('📦 Building web app...');
try {
    execSync('npm run build', {
        cwd: ROOT_DIR,
        stdio: 'inherit'
    });
    console.log('✅ Web build completed');
} catch (error) {
    console.error('❌ Web build failed:', error.message);
    process.exit(1);
}

// Step 2: Prepare mobile platform directory
console.log('📱 Preparing mobile platform...');
if (!existsSync(MOBILE_DIR)) {
    mkdirSync(MOBILE_DIR, { recursive: true });
}

// Step 3: Initialize Capacitor (if not already done)
const capacitorConfigPath = join(MOBILE_DIR, 'capacitor.config.json');
if (!existsSync(capacitorConfigPath)) {
    console.log('🔧 Initializing Capacitor...');
    try {
        execSync(`npx cap init "CSMA App" "com.csma.app" --web-dir="dist"`, {
            cwd: MOBILE_DIR,
            stdio: 'inherit'
        });
        console.log('✅ Capacitor initialized');
    } catch (error) {
        console.error('❌ Capacitor initialization failed:', error.message);
        process.exit(1);
    }
}

// Step 4: Copy web build to mobile www directory
console.log('📋 Syncing web build to mobile...');
const distDir = join(ROOT_DIR, 'dist');
const wwwDir = join(MOBILE_DIR, 'www');

try {
    // Clean www directory
    if (existsSync(wwwDir)) {
        rmSync(wwwDir, { recursive: true, force: true });
    }
    mkdirSync(wwwDir, { recursive: true });

    // Copy dist contents to www
    execSync(`cp -r ${distDir}/* ${wwwDir}/`, { stdio: 'pipe' });
    console.log('✅ Web build synced to mobile');
} catch (error) {
    console.error('❌ Failed to sync web build:', error.message);
    process.exit(1);
}

// Step 5: Add platforms (Android/iOS)
console.log('📱 Adding mobile platforms...');
const platforms = ['android', 'ios'];

for (const platform of platforms) {
    try {
        console.log(`Adding ${platform} platform...`);
        execSync(`npx cap add ${platform}`, {
            cwd: MOBILE_DIR,
            stdio: 'inherit'
        });
        console.log(`✅ ${platform} platform added`);
    } catch (error) {
        console.warn(`⚠️  Failed to add ${platform} platform:`, error.message);
        console.warn(`   You may need to install ${platform} development tools manually`);
    }
}

// Step 6: Copy Capacitor configuration
console.log('⚙️  Setting up Capacitor configuration...');
const capacitorConfig = {
    appId: 'com.csma.app',
    appName: 'CSMA App',
    webDir: 'www',
    bundledWebRuntime: false,
    plugins: {
        // Add any Capacitor plugins here
    }
};

// Write capacitor.config.json
try {
    const fs = await import('fs/promises');
    await fs.writeFile(
        capacitorConfigPath,
        JSON.stringify(capacitorConfig, null, 2)
    );
    console.log('✅ Capacitor config updated');
} catch (error) {
    console.error('❌ Failed to write Capacitor config:', error.message);
}

// Step 7: Create platform-specific instructions
console.log('📝 Creating deployment instructions...');
const instructions = `# CSMA Mobile Deployment Instructions

## Android
\`\`\`bash
cd platforms/mobile-capacitor
npx cap open android
# Or build APK:
npx cap build android
\`\`\`

## iOS
\`\`\`bash
cd platforms/mobile-capacitor
npx cap open ios
# Or build IPA:
npx cap build ios
\`\`\`

## Development
\`\`\`bash
# Sync changes after web build
npx cap sync

# Run on device/emulator
npx cap run android
npx cap run ios
\`\`\`
`;

try {
    const fs = await import('fs/promises');
    await fs.writeFile(
        join(MOBILE_DIR, 'DEPLOYMENT.md'),
        instructions
    );
    console.log('✅ Deployment instructions created');
} catch (error) {
    console.warn('⚠️  Failed to create deployment instructions');
}

console.log('');
console.log('🎉 Mobile build completed!');
console.log('');
console.log('Next steps:');
console.log(`1. cd platforms/mobile-capacitor`);
console.log(`2. npx cap open android  # or ios`);
console.log(`3. Build and run from your IDE`);
console.log('');
console.log('📱 Mobile app ready for deployment!');