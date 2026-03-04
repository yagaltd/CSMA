#!/usr/bin/env node

/**
 * CSMA Desktop Build Script
 * Builds web app and packages with Neutralino for desktop deployment
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, copyFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const PLATFORMS_DIR = join(ROOT_DIR, 'platforms');
const DESKTOP_DIR = join(PLATFORMS_DIR, 'desktop-neutralino');

console.log('🖥️  Starting CSMA desktop build...');

// Check if Neutralino CLI is installed
try {
    execSync('neu version', { stdio: 'pipe' });
} catch (error) {
    console.error('❌ Neutralino CLI not found. Install with: npm install -g @neutralinojs/neu');
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

// Step 2: Prepare desktop platform directory
console.log('🖥️  Preparing desktop platform...');
if (!existsSync(DESKTOP_DIR)) {
    mkdirSync(DESKTOP_DIR, { recursive: true });
}

// Step 3: Initialize Neutralino app (if not already done)
const neutralinoConfigPath = join(DESKTOP_DIR, 'neutralino.config.json');
if (!existsSync(neutralinoConfigPath)) {
    console.log('🔧 Initializing Neutralino app...');
    try {
        // Create basic Neutralino app structure
        execSync('neu create csma-desktop-app', {
            cwd: PLATFORMS_DIR,
            stdio: 'inherit'
        });

        // Move to desktop directory
        execSync(`mv csma-desktop-app desktop-neutralino`, {
            cwd: PLATFORMS_DIR,
            stdio: 'pipe'
        });

        console.log('✅ Neutralino app initialized');
    } catch (error) {
        console.error('❌ Neutralino initialization failed:', error.message);
        process.exit(1);
    }
}

// Step 4: Copy web build to Neutralino resources
console.log('📋 Syncing web build to desktop...');
const distDir = join(ROOT_DIR, 'dist');
const resourcesDir = join(DESKTOP_DIR, 'resources');

try {
    // Clean resources directory
    if (existsSync(resourcesDir)) {
        rmSync(resourcesDir, { recursive: true, force: true });
    }
    mkdirSync(resourcesDir, { recursive: true });

    // Copy dist contents to resources
    execSync(`cp -r ${distDir}/* ${resourcesDir}/`, { stdio: 'pipe' });
    console.log('✅ Web build synced to desktop');
} catch (error) {
    console.error('❌ Failed to sync web build:', error.message);
    process.exit(1);
}

// Step 5: Update Neutralino configuration
console.log('⚙️  Configuring Neutralino...');
const neutralinoConfig = {
    applicationId: "com.csma.desktop",
    version: "1.0.0",
    defaultMode: "window",
    port: 0,
    documentRoot: "/resources/",
    url: "/",
    enableServer: true,
    enableNativeAPI: true,
    tokenSecurity: "one-time",
    logging: {
        enabled: true,
        writeToLogFile: true
    },
    nativeAllowList: [
        "app.*",
        "os.*",
        "filesystem.*",
        "window.*",
        "events.*"
    ],
    modes: {
        window: {
            title: "CSMA Desktop App",
            width: 1200,
            height: 800,
            minWidth: 800,
            minHeight: 600,
            fullscreen: false,
            alwaysOnTop: false,
            enableInspector: true,
            borderless: false,
            maximize: false,
            hidden: false,
            resizable: true,
            icon: "/resources/favicon.ico"
        }
    },
    cli: {
        binaryName: "csma-desktop",
        resourcesPath: "/resources/",
        extensionsPath: "/extensions/",
        clientLibrary: "/resources/js/neutralino.js",
        binaryVersion: "4.14.1",
        clientVersion: "3.12.0"
    }
};

// Write neutralino.config.json
try {
    const fs = await import('fs/promises');
    await fs.writeFile(
        neutralinoConfigPath,
        JSON.stringify(neutralinoConfig, null, 2)
    );
    console.log('✅ Neutralino config updated');
} catch (error) {
    console.error('❌ Failed to write Neutralino config:', error.message);
}

// Step 6: Create desktop-specific instructions
console.log('📝 Creating deployment instructions...');
const instructions = `# CSMA Desktop Deployment Instructions

## Development
\`\`\`bash
cd platforms/desktop-neutralino

# Run in development mode
neu run

# Build for current platform
neu build
\`\`\`

## Distribution
\`\`\`bash
# Build for all platforms (Linux, Mac, Windows)
neu build --release

# The built binaries will be in dist/ directory
\`\`\`

## Platform-Specific Builds
\`\`\`bash
# Linux
neu build --release --target linux

# macOS
neu build --release --target mac

# Windows
neu build --release --target win
\`\`\`

## Customizing the App
- Edit \`neutralino.config.json\` for window settings
- Modify \`resources/\` for web app files
- Add native functionality using Neutralino APIs

## File Structure
\`\`\`
platforms/desktop-neutralino/
├── neutralino.config.json    # App configuration
├── resources/               # Web app files (from dist/)
├── dist/                    # Built binaries (after build)
└── DEPLOYMENT.md           # This file
\`\`\`
`;

try {
    const fs = await import('fs/promises');
    await fs.writeFile(
        join(DESKTOP_DIR, 'DEPLOYMENT.md'),
        instructions
    );
    console.log('✅ Deployment instructions created');
} catch (error) {
    console.warn('⚠️  Failed to create deployment instructions');
}

console.log('');
console.log('🎉 Desktop build completed!');
console.log('');
console.log('Next steps:');
console.log(`1. cd platforms/desktop-neutralino`);
console.log(`2. neu run                    # Development`);
console.log(`3. neu build --release       # Production build`);
console.log('');
console.log('🖥️  Desktop app ready for deployment!');