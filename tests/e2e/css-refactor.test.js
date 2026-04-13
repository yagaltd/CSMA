/**
 * CSS Refactor E2E Tests
 *
 * Validates the CSS architecture refactor:
 * - Part 1: File-system tests (read CSS directly from disk)
 * - Part 2: Browser tests via Playwriter (theme toggle, hardening classes)
 *
 * Run:
 *   npm run test:e2e
 *   — or standalone —
 *   node tests/e2e/css-refactor.test.js
 */

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readCss(relPath) {
  const fullPath = join(ROOT, relPath);
  assert.ok(existsSync(fullPath), `File must exist: ${relPath}`);
  return readFileSync(fullPath, 'utf-8');
}

let passes = 0;
let failures = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    passes++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failures++;
    results.push({ name, status: 'FAIL', error: e.message });
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Part 1: File-system tests
// ---------------------------------------------------------------------------

async function runFsTests() {
  console.log('\n── Part 1: File-system tests ──\n');

  await test('A: Token generation produces valid CSS — no [object Object]', async () => {
    const css = readCss('demo/generated/tokens.css');
    assert.ok(!css.includes('[object Object]'), 'tokens.css must not contain [object Object]');
    assert.ok(/--shadow-sm:/.test(css), '--shadow-sm must exist');
    assert.ok(/--motion-duration-fast:\s*\d+ms/.test(css), '--motion-duration-fast must end in ms');
    assert.ok(css.includes(':root[data-theme="contrast"]'), 'contrast theme block must exist');
  });

  await test('B: @import chain — all referenced files exist on disk', async () => {
    const mainCss = readCss('library/style/main.css');
    const imports = [...mainCss.matchAll(/@import\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    assert.ok(imports.length >= 5, `Expected at least 5 imports, got ${imports.length}`);
    const mainDir = 'library/style';
    for (const imp of imports) {
      let resolved;
      if (imp.startsWith('./')) {
        resolved = join(ROOT, mainDir, imp);
      } else if (imp.startsWith('../')) {
        resolved = join(ROOT, mainDir, imp);
      } else {
        resolved = join(ROOT, mainDir, imp);
      }
      assert.ok(existsSync(resolved), `Import target must exist: ${imp} → ${resolved}`);
    }
  });

  await test('C: @layer declaration present in main.css', async () => {
    const mainCss = readCss('library/style/main.css');
    const layerMatch = mainCss.match(/@layer\s+([^;]+);/);
    assert.ok(layerMatch, 'main.css must contain @layer declaration');
    const layers = layerMatch[1].split(',').map(l => l.trim());
    const expected = ['tokens', 'base', 'components', 'motion', 'layout', 'hardening', 'print'];
    for (const name of expected) {
      assert.ok(layers.includes(name), `@layer must include "${name}", got: ${layers.join(', ')}`);
    }
  });

  await test('D: No duplicate global reduced-motion — appears exactly once', async () => {
    // Scan all CSS files in src/style/ and its subdirectories
    const { readdirSync, statSync } = await import('node:fs');
    function walkCssFiles(dir) {
      const files = [];
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          files.push(...walkCssFiles(full));
        } else if (entry.endsWith('.css')) {
          files.push(full);
        }
      }
      return files;
    }
    const cssFiles = walkCssFiles(join(ROOT, 'library/style'));
    // Also include ui/components
    const uiFiles = walkCssFiles(join(ROOT, 'library/ui/components'));

    let globalReducedMotionCount = 0;
    let focusRingCount = 0;
    const focusRingFiles = [];

    for (const file of [...cssFiles, ...uiFiles]) {
      const content = readFileSync(file, 'utf-8');
      const rel = file.replace(ROOT + '/', '');

      // Count global reduced-motion (targets *, *::before, *::after)
      const re = /@media\s*\(\s*prefers-reduced-motion[^}]*\*[^}]*::before/s;
      // More precise: look for blocks that reset *, *::before, *::after
      const globalBlocks = content.match(/@media\s*\(\s*prefers-reduced-motion[^{]*\{[^}]*\*[^}]*::before/gs);
      if (globalBlocks) globalReducedMotionCount += globalBlocks.length;

      if (/\.focus-ring\s*\{/.test(content)) {
        focusRingCount++;
        focusRingFiles.push(rel);
      }
    }

    assert.equal(globalReducedMotionCount, 1,
      `Global @media (prefers-reduced-motion) with wildcard should appear exactly once, found ${globalReducedMotionCount}`);
    assert.equal(focusRingCount, 1,
      `.focus-ring should be defined in exactly 1 file, found in: ${focusRingFiles.join(', ')}`);
  });

  await test('H: base.css has no utility classes — only reset + typography', async () => {
    const css = readCss('library/style/base.css');
    assert.ok(!/\.flex\s*\{/.test(css), 'base.css must not contain .flex utility');
    assert.ok(!/\.items-center/.test(css), 'base.css must not contain .items-center');
    assert.ok(!/\.gap-/.test(css), 'base.css must not contain .gap- utilities');
    assert.ok(!/\.p-[0-9]\s*\{/.test(css), 'base.css must not contain .p-* spacing utilities');
    // Must still have typography and reset
    assert.ok(/h1/.test(css), 'base.css must preserve h1 typography');
    assert.ok(/box-sizing/.test(css), 'base.css must preserve reset (box-sizing)');
  });

  await test('Hardening split: all 6 files exist and have content', async () => {
    const files = [
      'text-overflow.css', 'states.css', 'accessibility.css',
      'i18n.css', 'loading.css', 'error.css'
    ];
    for (const f of files) {
      const css = readCss(`library/style/foundation/hardening/${f}`);
      assert.ok(css.length > 50, `${f} must have meaningful content`);
    }
    // Old monolithic file must be gone
    assert.ok(!existsSync(join(ROOT, 'library/style/foundation/hardening.css')),
      'Old hardening.css must be deleted');
  });

  await test('Stale files deleted: theme.css, utilities.css gone', async () => {
    assert.ok(!existsSync(join(ROOT, 'library/style/theme.css')), 'theme.css must be deleted');
    assert.ok(!existsSync(join(ROOT, 'library/style/foundation/utilities.css')), 'utilities.css must be renamed to layout.css');
    assert.ok(existsSync(join(ROOT, 'library/style/foundation/layout.css')), 'layout.css must exist');
  });
}

// ---------------------------------------------------------------------------
// Part 2: Browser tests via Playwriter
// ---------------------------------------------------------------------------

async function runBrowserTests() {
  console.log('\n── Part 2: Browser tests (Playwriter) ──\n');

  let sessionId = null;
  try {
    const out = execSync('playwriter session new --direct', { encoding: 'utf-8', timeout: 15_000 }).trim();
    // Parse session ID from output like "Session 2 created (direct CDP..."
    const match = out.match(/Session\s+(\d+)\s+created/);
    if (!match) throw new Error('Could not parse session ID from: ' + out);
    sessionId = match[1];
    console.log(`  Playwriter session: ${sessionId}`);
  } catch (e) {
    console.log('  ⚠️  Could not create Playwriter session — skipping browser tests');
    console.log(`     ${e.message.split('\n')[0]}`);
    console.log('     Ensure Chrome is running with remote debugging (--remote-debugging-port=9222).\n');
    return;
  }

  async function pw(code) {
    try {
      const out = execSync(
        `playwriter -s ${sessionId} -e "$(cat <<'EOF'\n${code}\nEOF\n)"`,
        { encoding: 'utf-8', timeout: 30_000 }
      );
      return { ok: true, out: out.trim() };
    } catch (e) {
      return { ok: false, out: (e.stdout || '') + '\n' + (e.stderr || '') };
    }
  }

  try {
    await test('E: Contrast theme renders with dark background', async () => {
      const r = await pw(`
const page = await context.newPage();
await page.goto("${BASE}/examples/landing/index.html");
await page.evaluate(() => { document.documentElement.dataset.theme = "contrast"; });
await page.waitForTimeout(500);
const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background'));
const fg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--foreground'));
console.log(JSON.stringify({ bg, fg }));
`);
      assert.ok(r.ok, `Playwriter failed: ${r.out.slice(-200)}`);
      // Parse the JSON from the last line of output
      const jsonLine = r.out.split('\n').filter(l => l.includes('{')).pop();
      assert.ok(jsonLine, `No JSON output found in: ${r.out.slice(-200)}`);
      const jsonStr = jsonLine.replace(/^.*\[log\]\s*/, '');
      const { bg, fg } = JSON.parse(jsonStr);
      assert.ok(bg && bg.trim().length > 0, '--background must be set');
      assert.ok(fg && fg.trim().length > 0, '--foreground must be set');
      // Background should be dark (not white)
      assert.ok(
        !bg.includes('255, 255, 255') && bg.trim() !== '#fff',
        `background should be dark, got: ${bg}`
      );
    });

    await test('F: Theme toggle cycles through themes', async () => {
      const r = await pw(`
const page = await context.newPage();
await page.goto("${BASE}/examples/landing/index.html");
await page.waitForSelector('[data-theme-toggle]');
const btn = page.locator('[data-theme-toggle]');
const theme1 = await page.evaluate(() => document.documentElement.dataset.theme || 'light');
await btn.click();
await page.waitForTimeout(300);
const theme2 = await page.evaluate(() => document.documentElement.dataset.theme);
await btn.click();
await page.waitForTimeout(300);
const theme3 = await page.evaluate(() => document.documentElement.dataset.theme);
await btn.click();
await page.waitForTimeout(300);
const theme4 = await page.evaluate(() => document.documentElement.dataset.theme);
console.log(JSON.stringify({ theme1, theme2, theme3, theme4 }));
`);
      assert.ok(r.ok, `Playwriter failed: ${r.out.slice(-200)}`);
      const jsonLine = r.out.split('\n').filter(l => l.includes('{')).pop();
      assert.ok(jsonLine, `No JSON output found in: ${r.out.slice(-200)}`);
      const jsonStr = jsonLine.replace(/^.*\[log\]\s*/, '');
      const { theme1, theme2, theme3, theme4 } = JSON.parse(jsonStr);
      assert.ok(theme1 === 'light' || theme1 === undefined, `First theme should be light, got ${theme1}`);
      assert.ok(theme2 && theme2 !== theme1, `Second theme should differ from first (${theme1} → ${theme2})`);
      assert.ok(theme3 && theme3 !== theme2, `Third theme should differ from second (${theme2} → ${theme3})`);
      // Should cycle back: light → dark → contrast → light
      if (theme2 === 'dark' && theme3 === 'contrast') {
        assert.equal(theme4, 'light', `Should cycle back to light, got ${theme4}`);
      }
    });

    await test('G: Hardening classes render correctly in browser', async () => {
      const r = await pw(`
const page = await context.newPage();
await page.goto("${BASE}/examples/landing/index.html");
await page.waitForLoadState('domcontentloaded');
const result = await page.evaluate(() => {
  const container = document.createElement('div');
  container.id = 'test-harness';
  container.innerHTML = \`
    <span class="truncate" style="max-width:100px">long text here that should be truncated</span>
    <div class="sr-only">hidden text</div>
    <div class="loading-spinner"></div>
    <div class="error-container"><span class="error-title">Error</span></div>
  \`;
  document.body.appendChild(container);

  const truncate = container.querySelector('.truncate');
  const srOnly = container.querySelector('.sr-only');
  const spinner = container.querySelector('.loading-spinner');
  const errorContainer = container.querySelector('.error-container');

  const tests = {
    truncateOverflow: getComputedStyle(truncate).overflow,
    truncateTextOverflow: getComputedStyle(truncate).textOverflow,
    srOnlyPosition: getComputedStyle(srOnly).position,
    srOnlyWidth: getComputedStyle(srOnly).width,
    spinnerBorderTopStyle: getComputedStyle(spinner).borderTopStyle,
    errorBorderWidth: getComputedStyle(errorContainer).borderWidth,
  };

  container.remove();
  return JSON.stringify(tests);
});
console.log(result);
`);
      assert.ok(r.ok, `Playwriter failed: ${r.out.slice(-200)}`);
      const jsonLine = r.out.split('\n').filter(l => l.includes('{')).pop();
      assert.ok(jsonLine, `No JSON output found in: ${r.out.slice(-200)}`);
      const jsonStr = jsonLine.replace(/^.*\[log\]\s*/, '');
      const t = JSON.parse(jsonStr);
      assert.equal(t.truncateOverflow, 'hidden', `truncate overflow should be hidden, got ${t.truncateOverflow}`);
      assert.equal(t.truncateTextOverflow, 'ellipsis', `truncate text-overflow should be ellipsis, got ${t.truncateTextOverflow}`);
      assert.equal(t.srOnlyPosition, 'absolute', `sr-only position should be absolute, got ${t.srOnlyPosition}`);
      assert.equal(t.spinnerBorderTopStyle, 'solid', `spinner border should be solid, got ${t.spinnerBorderTopStyle}`);
      assert.ok(parseFloat(t.errorBorderWidth) > 0, `error-container should have border, got ${t.errorBorderWidth}`);
    });

  } finally {
    try {
      execSync(`playwriter session reset ${sessionId}`, { encoding: 'utf-8', timeout: 5_000 });
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n📋 CSS Refactor E2E Tests');

  await runFsTests();
  await runBrowserTests();

  // Summary
  console.log('\n── Summary ──');
  console.log(`  Passed: ${passes}`);
  console.log(`  Failed: ${failures}`);
  console.log(`  Total:  ${passes + failures}`);

  if (failures > 0) {
    console.log('\n❌ Some tests failed:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  — ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
  }
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
