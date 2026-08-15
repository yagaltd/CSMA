#!/usr/bin/env node
/**
 * CSMA module certification gate.
 *
 * Usage: npm run certify:module -- <module> [...modules]
 *
 * For each module name, runs three gates in order:
 *   1. npx vitest run <module>            (file filter scoped to the module)
 *   2. node tooling/scripts/check-security.js
 *   3. node tooling/scripts/check-styles.js
 *
 * Prints a per-module PASS/FAIL summary and exits non-zero if any step of
 * any module fails. Plain node, no dependencies.
 */

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SECURITY_CHECK = join('tooling', 'scripts', 'check-security.js');
const STYLES_CHECK = join('tooling', 'scripts', 'check-styles.js');

/**
 * Spawn a command in the project root with inherited stdio so its output
 * stays readable inline. Resolves with the child's exit code (1 on spawn
 * failure or a null/undefined exit code).
 */
function run(label, command, args) {
    return new Promise((resolveRun) => {
        console.log(`\n${label}\n$ ${command} ${args.join(' ')}\n`);
        const child = spawn(command, args, {
            cwd: ROOT,
            stdio: 'inherit',
            shell: process.platform === 'win32'
        });
        child.on('error', (error) => {
            console.error(`[certify:module] failed to spawn ${command}: ${error.message}`);
            resolveRun(1);
        });
        child.on('close', (code) => resolveRun(code ?? 1));
    });
}

async function certify(moduleName) {
    console.log(`━━━ certify:module ${moduleName} ━━━`);
    const steps = {};

    steps.vitest = await run(
        `[${moduleName}] 1/3 module tests (vitest file filter: ${moduleName})`,
        'npx',
        ['vitest', 'run', moduleName]
    );
    steps.security = await run(
        `[${moduleName}] 2/3 security check`,
        process.execPath,
        [SECURITY_CHECK]
    );
    steps.styles = await run(
        `[${moduleName}] 3/3 style check`,
        process.execPath,
        [STYLES_CHECK]
    );

    for (const [step, code] of Object.entries(steps)) {
        console.log(`[${moduleName}] ${code === 0 ? 'PASS' : 'FAIL'} ${step} (exit ${code})`);
    }

    const failures = Object.values(steps).filter((code) => code !== 0).length;
    console.log(
        failures === 0
            ? `[${moduleName}] PASS — all certification steps passed`
            : `[${moduleName}] FAIL — ${failures} certification step(s) failed`
    );
    return failures === 0;
}

const modules = process.argv.slice(2);
if (modules.length === 0) {
    console.error('Usage: npm run certify:module -- <module> [...modules]');
    console.error('  For each module: vitest run <module>, security check, style check.');
    process.exit(1);
}

const outcomes = [];
for (const moduleName of modules) {
    const passed = await certify(moduleName);
    outcomes.push({ moduleName, passed });
}

console.log('━━━ certify:module summary ━━━');
for (const { moduleName, passed } of outcomes) {
    console.log(`  ${passed ? 'PASS' : 'FAIL'}  ${moduleName}`);
}
const failedModules = outcomes.filter(({ passed }) => !passed).length;
console.log(`${outcomes.length - failedModules}/${outcomes.length} module(s) certified`);
process.exit(failedModules > 0 ? 1 : 0);
