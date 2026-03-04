import fs from 'node:fs';
import path from 'node:path';
import { IslandAnalyzer } from '../../src/modules/static-render/compiler/IslandAnalyzer.js';

function collectHtmlFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const resolved = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectHtmlFiles(resolved));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            files.push(resolved);
        }
    }
    return files;
}

export function deriveRoute(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/');
    let route = normalized.replace(/index\.html$/i, '').replace(/\.html$/i, '');
    route = route.replace(/\/+/g, '/').replace(/\/$/, '');
    return route ? `/${route}` : '/';
}

export async function analyzeRoutes({ pagesDir, analyzerOptions = {}, previousManifest = null }) {
    if (!pagesDir || !fs.existsSync(pagesDir)) {
        return [];
    }
    const analyzer = new IslandAnalyzer(analyzerOptions);
    const htmlFiles = collectHtmlFiles(pagesDir);
    const previousMap = previousManifest && previousManifest.routes
        ? previousManifest.routes
        : {};
    return htmlFiles.map((filePath) => {
        const relativePath = path.relative(pagesDir, filePath);
        const route = deriveRoute(relativePath);
        const html = fs.readFileSync(filePath, 'utf-8');
        const classification = analyzer.classify({ route, html });
        const prev = previousMap[route];
        const changed = !prev || JSON.stringify(prev) !== JSON.stringify(classification);
        return { filePath, relativePath, route, html, classification, changed };
    });
}
