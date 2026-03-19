#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const COMPONENTS_DIR = join(ROOT, 'src/ui/components');
const PATTERNS_DIR = join(ROOT, 'src/ui/patterns');
const DOCS_DIR = join(ROOT, 'docs');
const registryModule = await import(join(ROOT, 'src/ui/components/component-registry.js'));
const registryIds = new Set(registryModule.componentRegistry.map((entry) => entry.id));
const issues = [];

function walk(dir, matcher) {
    const results = [];
    for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        const stats = statSync(fullPath);
        if (stats.isDirectory()) {
            results.push(...walk(fullPath, matcher));
        } else if (matcher(fullPath)) {
            results.push(fullPath);
        }
    }
    return results;
}

function report(file, message) {
    issues.push(`${file}: ${message}`);
}

for (const file of [
    ...walk(COMPONENTS_DIR, (path) => /\.(html|js|md|css)$/.test(path)),
    ...walk(PATTERNS_DIR, (path) => /\.html$/.test(path)),
    ...walk(DOCS_DIR, (path) => /\.md$/.test(path))
]) {
    const content = readFileSync(file, 'utf8');
    if (content.includes('demos.html')) {
        report(file, 'stale demos.html reference found');
    }
    if (content.includes('css/components.css')) {
        report(file, 'stale css/components.css reference found');
    }
}

for (const entry of readdirSync(COMPONENTS_DIR)) {
    const dir = join(COMPONENTS_DIR, entry);
    if (!statSync(dir).isDirectory() || entry === 'shared') {
        continue;
    }

    if (!registryIds.has(entry)) {
        report(dir, 'component is missing from component-registry.js');
    }

    const demoPath = join(dir, `${entry}.demo.html`);
    if (!existsSync(demoPath)) {
        report(dir, 'component is missing a standalone demo page');
    } else {
        const demoContent = readFileSync(demoPath, 'utf8');
        if (!demoContent.includes(`href="../index.html#${entry}"`)) {
            report(demoPath, 'demo backlink does not point to the canonical explorer anchor');
        }
    }

    const jsPath = join(dir, `${entry}.js`);
    if (existsSync(jsPath)) {
        const jsContent = readFileSync(jsPath, 'utf8');
        if (!jsContent.includes('export const componentDependencies')) {
            report(jsPath, 'JS-backed component is missing componentDependencies metadata');
        }
    }
}

for (const entry of registryModule.componentRegistry) {
    if (entry.demoPath) {
        const expected = join(ROOT, entry.demoPath.replace(/^\//, ''));
        if (!existsSync(expected)) {
            report(expected, `registry demoPath for ${entry.id} does not exist`);
        }
    }
}

if (issues.length > 0) {
    console.error('\nUI library integrity check failed:');
    for (const issue of issues) {
        console.error(`- ${issue}`);
    }
    process.exit(1);
}

console.log('UI library integrity check passed ✓');
