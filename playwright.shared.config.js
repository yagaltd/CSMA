import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ssmaDir = path.resolve(__dirname, '../SSMA');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true
  },
  webServer: [
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000
    },
    {
      command: 'npm start',
      cwd: ssmaDir,
      port: 5050,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000
    }
  ]
});
