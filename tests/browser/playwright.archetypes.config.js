import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: 'archetypes.spec.js',
  outputDir: 'output/playwright',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
});
