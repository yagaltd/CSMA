#!/usr/bin/env node
/**
 * Generate ai-system-map.json
 * Scans project structure and creates context map for AI agents
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

async function scanDirectory(dir, baseDir = dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const structure = {};

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        // Skip node_modules, .git, dist
        if (entry.name.match(/^(node_modules|\.git|dist|\.vite)$/)) {
            continue;
        }

        if (entry.isDirectory()) {
            structure[entry.name] = await scanDirectory(fullPath, baseDir);
        } else {
            structure[entry.name] = {
                type: 'file',
                ext: path.extname(entry.name),
                path: relativePath
            };
        }
    }

    return structure;
}

async function parseAgents() {
    try {
        const agentsPath = path.join(projectRoot, 'AGENTS.md');
        const content = await fs.readFile(agentsPath, 'utf-8');

        const agents = [];
        const serviceRegex = /### (\w+)\s*\(.*?\)/g;
        let match;

        while ((match = serviceRegex.exec(content)) !== null) {
            agents.push(match[1]);
        }

        return agents;
    } catch (error) {
        return [];
    }
}

async function parseContracts() {
    try {
        const contractsPath = path.join(projectRoot, 'src/runtime/Contracts.js');
        const content = await fs.readFile(contractsPath, 'utf-8');

        const contracts = [];
        const contractRegex = /export const (\w+) = [{]/g;
        let match;

        while ((match = contractRegex.exec(content)) !== null) {
            contracts.push(match[1]);
        }

        return contracts;
    } catch (error) {
        return [];
    }
}

async function getPackageInfo() {
    try {
        const pkgPath = path.join(projectRoot, 'package.json');
        const content = await fs.readFile(pkgPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        return {};
    }
}

async function generateMap() {
    console.log('🔍 Scanning project structure...');

    const structure = await scanDirectory(path.join(projectRoot, 'src'));
    const agents = await parseAgents();
    const contracts = await parseContracts();
    const pkg = await getPackageInfo();

    const aiSystemMap = {
        version: '1.0',
        generated: new Date().toISOString(),

        // Project info
        project: {
            name: pkg.name || 'csma-kit',
            version: pkg.version || '1.0.0',
            description: pkg.description || 'CSMA Kit'
        },

        // Core architecture
        architecture: {
            pattern: 'CSMA',
            reactivity: 'CSS-class',
            security: '6-layer zero-trust',
            validation: 'Homemade (forked Superstruct)',
            bundler: 'Vite'
        },

        // Runtime components
        runtime: {
            core: ['EventBus', 'ServiceManager', 'Validation', 'Contracts'],
            optional: ['Router', 'Storage', 'I18n', 'LogAccumulator', 'MetaManager'],
            features: {
                pwa: 'Service Worker + offline support',
                routing: 'Hash-based SPA routing',
                i18n: 'Internationalization',
                storage: 'IndexedDB wrapper',
                devtools: 'Development panel (dev mode only)'
            }
        },

        // File structure
        structure,

        // Services/Agents
        agents: agents.length > 0 ? agents : ['ExampleService'],

        // Contracts
        contracts: contracts.length > 0 ? contracts : [],

        // Stack
        stack: {
            runtime: pkg.dependencies || {},
            devDependencies: pkg.devDependencies || {}
        },

        // Guidelines
        guidelines: {
            security: 'Zero-trust validation, CSP headers, input sanitization',
            reactivity: 'CSS-class pattern for 10x faster DOM updates',
            validation: 'Runtime validation ships to production',
            testing: 'Vitest for unit tests',
            bundleSize: 'Target <25KB gzipped total'
        }
    };

    const outputPath = path.join(projectRoot, 'ai-system-map.json');
    await fs.writeFile(outputPath, JSON.stringify(aiSystemMap, null, 2));

    console.log('✅ Generated ai-system-map.json');
    console.log(`   Agents: ${agents.length}`);
    console.log(`   Contracts: ${contracts.length}`);
    console.log(`   Location: ${outputPath}`);
}

generateMap().catch(console.error);
