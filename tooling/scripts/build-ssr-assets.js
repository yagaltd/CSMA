import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SUPPORTED_APPS, ROOT, buildStaticAssets } from './build-static-render.js';
import { loadSSRConfig } from '../../server/ssr-hono/app.js';

function parseAppArg(argv) {
  const appIndex = argv.indexOf('--app');
  if (appIndex >= 0 && argv[appIndex + 1]) {
    return argv[appIndex + 1];
  }
  return 'demo';
}

async function main() {
  const appName = parseAppArg(process.argv.slice(2));
  if (!SUPPORTED_APPS.has(appName)) {
    throw new Error(`[ssr-build] Unsupported app "${appName}". Expected one of: ${[...SUPPORTED_APPS].join(', ')}`);
  }

  const config = await loadSSRConfig(appName);
  if (!config.enabled) {
    throw new Error(
      `[ssr-build] ${appName} has SSR disabled. Enable SSR_CONFIG.enabled or use an ssr-ready preset first.`
    );
  }
  const outDir = path.resolve(ROOT, config.publicAssetsDir);
  await buildStaticAssets(appName, outDir);
  console.log(`[ssr-build] Wrote assets for ${appName} to ${path.relative(ROOT, outDir)}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
