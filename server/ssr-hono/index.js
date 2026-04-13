import { createSSRApp } from './app.js';

function parseAppArg(argv) {
  const appIndex = argv.indexOf('--app');
  if (appIndex >= 0 && argv[appIndex + 1]) {
    return argv[appIndex + 1];
  }
  return 'demo';
}

async function main() {
  if (typeof Bun === 'undefined' || typeof Bun.serve !== 'function') {
    throw new Error('[ssr] Bun runtime is required for the Phase 4 Hono host.');
  }

  const appName = parseAppArg(process.argv.slice(2));
  const { app, config } = await createSSRApp({ appName });

  Bun.serve({
    port: config.port,
    fetch: app.fetch
  });

  console.log(`[ssr] Serving ${appName} on http://localhost:${config.port}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
