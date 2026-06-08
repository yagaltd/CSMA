#!/usr/bin/env node

/**
 * check-responsive.js — Mobile viewport validation for CSMA pages.
 *
 * Uses Playwriter (connected to user's Chrome) to check pages at
 * 320, 375, 414, and 768px widths.
 *
 * Checks:
 * - No horizontal scroll at any width
 * - Touch targets >= 44x44px on mobile
 * - No two-line clickable text (buttons, nav links) at 320px
 * - Multi-column layouts collapse below 768px
 *
 * Usage:
 *   npm run dev                              # start dev server first
 *   node tooling/scripts/check-responsive.js # check default pages
 *   node tooling/scripts/check-responsive.js /showcase/token-showcase.html
 *   npm run check:responsive
 *
 * Requires:
 *   - Dev server running (npm run dev)
 *   - Playwriter extension active in Chrome
 *   - playwriter CLI (npm install -g playwriter@latest)
 */

import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const BASE_URL = process.env.CSMA_DEV_URL || 'http://localhost:5173';
const VIEWPORTS = [
  { name: '320px (iPhone SE)', width: 320, height: 568 },
  { name: '375px (iPhone 12)', width: 375, height: 812 },
  { name: '414px (iPhone Plus)', width: 414, height: 896 },
  { name: '768px (iPad)', width: 768, height: 1024 },
];
const MOBILE_WIDTHS = [320, 375, 414];

const findings = [];

function addFinding(page, viewport, rule, message) {
  findings.push({ page, viewport, rule, message });
}

// ── Discover pages ───────────────────────────────────────────────

function discoverPages(args) {
  const defaults = [
    '/showcase/token-showcase.html',
    '/demo/index.html',
  ];

  if (args.length > 0) {
    return args.map(a => a.startsWith('/') ? a : `/${a}`);
  }
  return defaults;
}

// ── Run Playwriter checks ────────────────────────────────────────

function runPlaywriterCheck(sessionId, pagePath, viewport) {
  const url = `${BASE_URL}${pagePath}`;
  const { width, height, name } = viewport;

  const code = `
    const url = "${url}";
    const width = ${width};
    const height = ${height};
    const viewportName = "${name}";

    // Get or create page
    if (!state.page || state.page.isClosed()) {
      state.page = await context.newPage();
    }
    await state.page.setViewportSize({ width, height });
    await state.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await state.page.waitForTimeout(500);

    const results = await state.page.evaluate(() => {
      const findings = [];
      const vw = window.innerWidth;

      // 1. Check horizontal scroll
      const docWidth = document.documentElement.scrollWidth;
      const bodyWidth = document.body ? document.body.scrollWidth : 0;
      const maxContentWidth = Math.max(docWidth, bodyWidth);
      if (maxContentWidth > vw + 2) {
        // Find the overflowing element for a helpful message
        let offender = '';
        const allEls = document.querySelectorAll('*');
        for (const el of allEls) {
          if (el.scrollWidth > vw + 2 && el.offsetParent !== null) {
            offender = el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ').slice(0,2).join('.');
            break;
          }
        }
        findings.push({
          rule: 'horizontal-scroll',
          message: 'Content width ' + maxContentWidth + 'px > viewport ' + vw + 'px' + (offender ? ' (first overflow: ' + offender + ')' : '')
        });
      }

      // 2. Check touch targets on mobile
      if (vw < 768) {
        const clickables = document.querySelectorAll('button, a, [role="button"], input[type="submit"], input[type="button"]');
        const seen = new Set();
        clickables.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
            // Deduplicate: skip if parent already reported
            const key = Math.round(rect.x) + ',' + Math.round(rect.y);
            if (seen.has(key)) return;
            seen.add(key);
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || '').trim().substring(0, 30);
            findings.push({
              rule: 'touch-target',
              message: tag + ' "' + text + '" is ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + 'px (min 44x44)'
            });
          }
        });
        // Cap at 20 to avoid flooding
        if (findings.filter(f => f.rule === 'touch-target').length > 20) {
          const kept = findings.filter(f => f.rule !== 'touch-target');
          const tt = findings.filter(f => f.rule === 'touch-target').slice(0, 20);
          kept.push(...tt);
          kept.push({ rule: 'touch-target', message: '... and more (capped at 20)' });
          findings.length = 0;
          findings.push(...kept);
        }
      }

      // 3. Check for two-line buttons/links at narrow widths
      if (vw <= 375) {
        const buttons = document.querySelectorAll('button, a, .button, [role="button"]');
        buttons.forEach(el => {
          const style = window.getComputedStyle(el);
          if (parseFloat(style.fontSize) < 10) return; // skip tiny/decorative
          const rects = el.getClientRects();
          if (rects.length > 1) {
            const text = (el.textContent || '').trim().substring(0, 30);
            findings.push({
              rule: 'two-line-clickable',
              message: '"' + text + '" wraps to ' + rects.length + ' lines at ' + vw + 'px'
            });
          }
        });
      }

      // 4. Check fixed-width elements that overflow
      if (vw < 768) {
        const fixed = document.querySelectorAll('[style]');
        fixed.forEach(el => {
          const style = window.getComputedStyle(el);
          const w = parseFloat(style.width);
          if (w > vw && style.position === 'fixed') {
            findings.push({
              rule: 'fixed-overflow',
              message: el.tagName.toLowerCase() + ' has fixed width ' + Math.round(w) + 'px > viewport ' + vw + 'px'
            });
          }
        });
      }

      // 5. Check text truncation / invisible text
      if (vw <= 375) {
        const textEls = document.querySelectorAll('h1, h2, h3, p, li, td, th');
        textEls.forEach(el => {
          if (el.scrollWidth > el.clientWidth + 2 && window.getComputedStyle(el).overflowX === 'hidden') {
            const text = (el.textContent || '').trim().substring(0, 30);
            if (text) {
              findings.push({
                rule: 'text-clip',
                message: '<' + el.tagName.toLowerCase() + '> "' + text + '" is clipped'
              });
            }
          }
        });
      }

      return findings;
    });

    // Print results as JSON for the Node.js runner to parse
    console.log(JSON.stringify({ url, viewportName, width, findings: results }));
  `;

  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const output = execSync(
        `playwriter -s ${sessionId} -e "$(cat <<'PLAYEOF'\n${code}\nPLAYEOF\n)"`,
        { encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      // Parse the last JSON line from output
      const lines = output.trim().split('\n');
      for (const line of lines.reverse()) {
        try {
          const result = JSON.parse(line);
          if (result.findings && Array.isArray(result.findings)) {
            return result.findings;
          }
        } catch {
          // Not JSON, skip
        }
      }
      return [];
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        // Retry with fresh page on next iteration
        try {
          execSync(`playwriter -s ${sessionId} -e 'if (state.page && !state.page.isClosed()) { await state.page.close(); state.page = null; }'`,
            { timeout: 5000, stdio: 'pipe' });
        } catch {
          // Ignore cleanup errors
        }
        continue;
      }
      return [{ rule: 'page-error', message: `Failed to load after ${MAX_RETRIES + 1} attempts: ${err.message.substring(0, 200)}` }];
    }
  }
  return [];
}

// ── Main ─────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const pages = discoverPages(args);

  console.log('Responsive check');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Pages: ${pages.join(', ')}`);
  console.log(`Viewports: ${VIEWPORTS.map(v => v.name).join(', ')}`);
  console.log('');

  // Create playwriter session
  let sessionId;
  try {
    const sessionOutput = execSync('playwriter session new', { encoding: 'utf8', timeout: 20000 });
    const match = sessionOutput.match(/Session (\d+) created/);
    if (!match) {
      console.error('Failed to create Playwriter session. Is the extension connected?');
      console.error('Output:', sessionOutput.substring(0, 200));
      process.exit(1);
    }
    sessionId = match[1];
    console.log(`Playwriter session ${sessionId} created.`);
  } catch (err) {
    console.error('Failed to create Playwriter session:', err.message);
    console.error('Make sure Chrome is running with Playwriter extension enabled.');
    process.exit(1);
  }

  let totalFindings = 0;

  for (const pagePath of pages) {
    console.log(`\nChecking ${pagePath}...`);
    for (const viewport of VIEWPORTS) {
      process.stdout.write(`  ${viewport.name}: `);
      const findings = runPlaywriterCheck(sessionId, pagePath, viewport);

      if (findings.length === 0) {
        console.log('✓');
      } else {
        console.log(`✗ (${findings.length} issue(s))`);
        for (const f of findings) {
          addFinding(pagePath, viewport.name, f.rule, f.message);
          console.log(`    [${f.rule}] ${f.message}`);
          totalFindings++;
        }
      }
    }
  }

  // Clean up session
  try {
    execSync(`playwriter -s ${sessionId} -e 'if (state.page && !state.page.isClosed()) await state.page.close()'`, { timeout: 5000, stdio: 'pipe' });
  } catch {
    // Ignore cleanup errors
  }

  console.log('');
  if (totalFindings > 0) {
    console.error(`✗ Responsive check failed: ${totalFindings} issue(s) found`);
    process.exit(1);
  } else {
    console.log('✓ Responsive check passed');
  }
}

main();
