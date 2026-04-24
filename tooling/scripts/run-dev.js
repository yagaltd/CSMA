import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

function resolveOpenTarget(mode) {
    if (mode === 'demo') return '/demo/';
    if (mode === 'showcase') return '/showcase/token-showcase.html';
    if (mode && mode.startsWith('/')) return mode;
    if (existsSync(resolve(process.cwd(), 'frontend/index.html'))) {
        return '/frontend/';
    }
    return '/demo/';
}

const rawArgs = process.argv.slice(2);
const firstArg = rawArgs[0];
const hasExplicitMode = firstArg && !firstArg.startsWith('-');
const mode = hasExplicitMode ? firstArg : 'auto';
const passthroughArgs = hasExplicitMode ? rawArgs.slice(1) : rawArgs;
const openTarget = resolveOpenTarget(mode);
const viteBin = resolve(process.cwd(), 'node_modules/vite/bin/vite.js');
const args = [viteBin, '--open', openTarget, ...passthroughArgs];

const child = spawn(process.execPath, args, {
    stdio: 'inherit',
    env: process.env
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});
