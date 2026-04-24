import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { validateProjectManifest } from './generate-project-artifacts.js';

const RESERVED_FRONTEND_FILES = new Set(['shell.html']);

function walk(dir) {
    const entries = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            entries.push(...walk(fullPath));
        } else {
            entries.push(fullPath);
        }
    }
    return entries;
}

function toPosix(filePath) {
    return filePath.split(path.sep).join('/');
}

function normalizeRoutePath(routePath) {
    if (!routePath || routePath === '/') {
        return '/';
    }

    const normalized = routePath.startsWith('/') ? routePath : `/${routePath}`;
    return normalized.replace(/\/{2,}/g, '/').replace(/\/+$/, '') || '/';
}

function routeInputName(routePath, isNotFound) {
    if (isNotFound) {
        return '404';
    }

    if (routePath === '/') {
        return 'index';
    }

    return `${routePath.replace(/^\//, '')}/index`;
}

export function mapFrontendHtmlFile(relativePath) {
    const normalized = toPosix(relativePath);
    if (!normalized.startsWith('frontend/') || !normalized.endsWith('.html')) {
        return null;
    }

    const localPath = normalized.slice('frontend/'.length);
    if (RESERVED_FRONTEND_FILES.has(localPath)) {
        return null;
    }

    const isNotFound = localPath === '404.html';
    if (isNotFound) {
        return {
            relativePath: normalized,
            routePath: '/404',
            inputName: '404',
            isNotFound: true
        };
    }

    let routePath;
    if (localPath === 'index.html') {
        routePath = '/';
    } else if (localPath.endsWith('/index.html')) {
        routePath = `/${localPath.slice(0, -'/index.html'.length)}`;
    } else {
        routePath = `/${localPath.slice(0, -'.html'.length)}`;
    }

    routePath = normalizeRoutePath(routePath);

    return {
        relativePath: normalized,
        routePath,
        inputName: routeInputName(routePath, false),
        isNotFound: false
    };
}

export function discoverFrontendHtmlRoutes(rootDir = process.cwd()) {
    const frontendDir = path.join(rootDir, 'frontend');
    if (!existsSync(frontendDir)) {
        return {
            hasFrontend: false,
            entries: [],
            publicRoutes: [],
            errors: [],
            hasHtmlPageModules: false,
            hasShell: false
        };
    }

    const files = walk(frontendDir);
    const htmlEntries = files
        .filter((filePath) => filePath.endsWith('.html'))
        .map((filePath) => {
            const relativePath = toPosix(path.relative(rootDir, filePath));
            const mapped = mapFrontendHtmlFile(relativePath);
            return mapped ? {
                ...mapped,
                absolutePath: filePath
            } : null;
        })
        .filter(Boolean);

    const routeOwners = new Map();
    const errors = [];
    for (const entry of htmlEntries) {
        if (!routeOwners.has(entry.routePath)) {
            routeOwners.set(entry.routePath, entry.relativePath);
            continue;
        }

        errors.push(
            `Duplicate frontend sources map to "${entry.routePath}": ${routeOwners.get(entry.routePath)} and ${entry.relativePath}`
        );
    }

    const pagesDir = path.join(frontendDir, 'pages');
    const hasHtmlPageModules = existsSync(pagesDir) && walk(pagesDir).some((filePath) => {
        if (!filePath.endsWith('.js')) {
            return false;
        }

        return /export\s+const\s+html\s*=/.test(readFileSync(filePath, 'utf8'));
    });

    return {
        hasFrontend: true,
        entries: htmlEntries,
        publicRoutes: htmlEntries.filter((entry) => !entry.isNotFound).map((entry) => entry.routePath).sort(),
        errors,
        hasHtmlPageModules,
        hasShell: existsSync(path.join(frontendDir, 'shell.html'))
    };
}

export function createFrontendViteInputs(rootDir = process.cwd()) {
    const inputs = {
        'demo/index': path.join(rootDir, 'demo', 'index.html'),
        'showcase/token-showcase': path.join(rootDir, 'showcase', 'token-showcase.html')
    };

    const discovered = discoverFrontendHtmlRoutes(rootDir);
    if (!discovered.hasFrontend) {
        return inputs;
    }

    for (const entry of discovered.entries) {
        inputs[entry.inputName] = path.join(rootDir, entry.relativePath);
    }

    return inputs;
}

export function verifyFrontendRoutes(rootDir = process.cwd()) {
    const frontend = discoverFrontendHtmlRoutes(rootDir);
    const errors = [...frontend.errors];
    const warnings = [];

    if (!frontend.hasFrontend) {
        return {
            ok: true,
            skipped: true,
            errors,
            warnings,
            frontend
        };
    }

    const manifestPath = path.join(rootDir, 'project-manifest.json');
    if (!existsSync(manifestPath)) {
        errors.push('Missing project-manifest.json for frontend route verification.');
        return { ok: false, skipped: false, errors, warnings, frontend };
    }

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const validation = validateProjectManifest(manifest);
    if (validation.errors.length > 0) {
        errors.push(...validation.errors);
        return { ok: false, skipped: false, errors, warnings, frontend };
    }

    const normalizedManifest = validation.manifest;
    const expectedRoutes = (normalizedManifest.web?.routes || []).filter((route) => route !== '/404').sort();
    const actualRoutes = frontend.publicRoutes.filter((route) => route !== '/404').sort();

    if (frontend.hasHtmlPageModules && actualRoutes.length > 0) {
        errors.push('Mixed delivery artifacts detected: public HTML routes and frontend/pages/*.js HTML modules cannot coexist in static-mpa delivery.');
    }

    const missingRoutes = expectedRoutes.filter((route) => !actualRoutes.includes(route));
    const unexpectedRoutes = actualRoutes.filter((route) => !expectedRoutes.includes(route));

    if (missingRoutes.length > 0) {
        errors.push(`Frontend is missing planned public routes: ${missingRoutes.join(', ')}`);
    }

    if (unexpectedRoutes.length > 0) {
        errors.push(`Frontend defines public routes not present in project-manifest.json: ${unexpectedRoutes.join(', ')}`);
    }

    if (expectedRoutes.length > 1 && !frontend.entries.some((entry) => entry.isNotFound)) {
        errors.push('Public multi-page frontend is missing frontend/404.html.');
    }

    return {
        ok: errors.length === 0,
        skipped: false,
        errors,
        warnings,
        frontend,
        expectedRoutes,
        actualRoutes
    };
}
