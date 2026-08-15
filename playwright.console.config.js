import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: 'console-guard.spec.js',
  outputDir: 'output/playwright',
  timeout: 45_000,
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    headless: true,
  },
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/demo/index.html',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
