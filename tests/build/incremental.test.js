import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, it, expect } from 'vitest';
import { runHybridBuild } from '../../scripts/build/runHybridBuild.js';

const ROOT = path.resolve(__dirname, '../..');
const PAGES_DIR = path.join(ROOT, 'src/pages');
const TEST_PAGE = path.join(PAGES_DIR, 'test', 'incremental.html');

function writeTestPage(content) {
  fs.mkdirSync(path.dirname(TEST_PAGE), { recursive: true });
  fs.writeFileSync(TEST_PAGE, content, 'utf-8');
}

afterEach(() => {
  if (fs.existsSync(TEST_PAGE)) {
    fs.rmSync(TEST_PAGE);
  }
});

describe('hybrid build incremental mode', () => {
  it('skips unchanged templates when incremental flag is set', async () => {
    writeTestPage('<html><body><div>v1</div></body></html>');
    await runHybridBuild({ pagesDir: PAGES_DIR, transportBase: 'http://127.0.0.1:5050' });
    writeTestPage('<html><body><div>v1</div></body></html>');
    await runHybridBuild({ pagesDir: PAGES_DIR, transportBase: 'http://127.0.0.1:5050', incremental: true });
    writeTestPage('<html><body><div>v2</div></body></html>');
    await runHybridBuild({ pagesDir: PAGES_DIR, transportBase: 'http://127.0.0.1:5050', incremental: true });
  });
});
