import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

async function collectFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function getSizeInfo(filePath) {
  const data = await fs.readFile(filePath);
  const raw = data.byteLength;
  const gzipped = zlib.gzipSync(data, { level: 9 }).byteLength;
  return { raw, gzipped };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} kB`;
}

async function run() {
  try {
    await fs.access(DIST_DIR);
  } catch {
    console.error('[bundle-analyze] dist/ not found. Run "npm run build:prod" first.');
    process.exit(1);
  }

  const files = await collectFiles(DIST_DIR);
  const summary = [];

  for (const file of files) {
    const ext = path.extname(file);
    if (!['.js', '.css', '.html'].includes(ext)) continue;
    const { raw, gzipped } = await getSizeInfo(file);
    summary.push({
      file: path.relative(ROOT, file),
      raw,
      gzipped
    });
  }

  summary.sort((a, b) => b.raw - a.raw);

  const totalRaw = summary.reduce((acc, item) => acc + item.raw, 0);
  const totalGzip = summary.reduce((acc, item) => acc + item.gzipped, 0);

  console.log('┌───────────────────────────────┐');
  console.log('│   CSMA Bundle Size Report     │');
  console.log('└───────────────────────────────┘');

  summary.forEach((item) => {
    console.log(
      `${item.file.padEnd(40)} raw: ${formatBytes(item.raw).padStart(10)}  gzip: ${formatBytes(item.gzipped).padStart(10)}`
    );
  });

  console.log('─────────────────────────────────');
  console.log(`Total raw size : ${formatBytes(totalRaw)}`);
  console.log(`Total gzip size: ${formatBytes(totalGzip)}`);
}

run();
