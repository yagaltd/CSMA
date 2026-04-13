import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');

export const TOOLING_GENERATED_DIR = path.join(ROOT, 'tooling', 'generated');

export function toolingGeneratedPath(filename) {
  return path.join(TOOLING_GENERATED_DIR, filename);
}

export function appGeneratedPath(appName, filename) {
  return path.join(ROOT, appName, 'generated', filename);
}

export function appTokensPath(appName) {
  return appGeneratedPath(appName, 'tokens.css');
}

export function appDesignTokensPath(appName) {
  return path.join(ROOT, appName, 'design-tokens.json');
}
