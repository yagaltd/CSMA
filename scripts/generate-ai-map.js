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

async function exists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

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

async function parseSkills() {
    const docsDir = path.join(projectRoot, 'docs');
    try {
        const entries = await fs.readdir(docsDir, { withFileTypes: true });
        const skills = [];

        for (const entry of entries) {
            if (!entry.isDirectory() || !entry.name.startsWith('csma-')) {
                continue;
            }

            const skillPath = path.join(docsDir, entry.name, 'SKILL.md');
            if (!await exists(skillPath)) {
                continue;
            }

            const content = await fs.readFile(skillPath, 'utf-8');
            const name = content.match(/^name:\s*"?(.*?)"?$/m)?.[1] || entry.name;
            const description = content.match(/^description:\s*>-\s*$/m)
                ? `${entry.name} skill`
                : (content.match(/^description:\s*"?(.*?)"?$/m)?.[1] || null);

            skills.push({
                id: entry.name,
                name,
                path: `docs/${entry.name}/SKILL.md`,
                description
            });
        }

        return skills.sort((a, b) => a.id.localeCompare(b.id));
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
    const skills = await parseSkills();
    const pkg = await getPackageInfo();

    const aiSystemMap = {
        version: '1.1',
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
            observability: {
                localDiagnostics: {
                    owner: 'LogAccumulator',
                    files: [
                        'src/runtime/LogAccumulator.js',
                        'src/runtime/ErrorBoundary.js',
                        'src/runtime/diagnosticSnapshot.js'
                    ],
                    responsibilities: [
                        'local error and security logging',
                        'contract-violation capture',
                        'error boundary integration',
                        'diagnostic snapshot export'
                    ]
                },
                outboundTelemetry: {
                    owner: 'AnalyticsService',
                    files: [
                        'src/modules/analytics/services/AnalyticsService.js',
                        'src/modules/analytics/services/EventClassifier.js',
                        'src/modules/analytics/services/EventAggregator.js',
                        'src/modules/analytics/services/SecurityScanner.js',
                        'src/modules/analytics/consent/ConsentService.js',
                        'src/runtime/seoAudit.js'
                    ],
                    responsibilities: [
                        'page views and custom analytics events',
                        'classification, aggregation, and batching',
                        'SEO-enriched telemetry',
                        'consent-gated outbound delivery'
                    ]
                },
                publicSurface: [
                    'window.csma.logAccumulator',
                    'window.csma.analytics',
                    'window.csma.analyticsConsent',
                    'window.csma.diagnose()',
                    'window.csma.seoAudit()'
                ],
                rules: [
                    'LogAccumulator is local diagnostics only',
                    'AnalyticsService owns outbound telemetry and website analytics',
                    'Consent gates outbound analytics, not local diagnostics'
                ]
            },
            features: {
                pwa: 'Service Worker + offline support',
                routing: 'Hash-based SPA routing',
                i18n: 'Internationalization',
                storage: 'IndexedDB wrapper'
            }
        },

        observability: {
            split: {
                diagnostics: 'src/runtime/LogAccumulator.js',
                telemetry: 'src/modules/analytics/services/AnalyticsService.js'
            },
            consent: {
                service: 'src/modules/analytics/consent/ConsentService.js',
                storageKey: 'csma.analyticsConsent.v1',
                scopes: ['ui_analytics', 'performance', 'error_tracking', 'security']
            },
            seo: {
                audit: 'src/runtime/seoAudit.js',
                snapshot: 'src/runtime/diagnosticSnapshot.js'
            },
            tests: [
                'tests/log-accumulator.test.js',
                'tests/error-boundary.test.js',
                'tests/diagnostic-snapshot.test.js',
                'tests/analytics-service.test.js',
                'tests/analytics-module.test.js',
                'tests/seo-audit.test.js',
                'tests/consent-service.test.js',
                'tests/analytics-consent-ui.test.js'
            ]
        },

        integrations: {
            ssma: {
                aiProvider: {
                    file: 'src/modules/ai/providers/SSMAGatewayProvider.js',
                    defaultQueryBoundary: 'POST /query/ai.generate'
                },
                telemetry: {
                    logsBatchEndpoint: '/logs/batch'
                },
                realtime: {
                    websocket: '/optimistic/ws',
                    sse: '/optimistic/events'
                }
            }
        },

        // File structure
        structure,

        skills,

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
    console.log(`   Skills: ${skills.length}`);
    console.log(`   Location: ${outputPath}`);
}

generateMap().catch(console.error);
