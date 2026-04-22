import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');

export const TOOLING_GENERATED_DIR = path.join(ROOT, 'tooling', 'generated');
export const SRC_STYLE_DIR = path.join(ROOT, 'src', 'style');

export function toolingGeneratedPath(filename) {
  return path.join(TOOLING_GENERATED_DIR, filename);
}

export function srcStylePath(filename) {
  return path.join(SRC_STYLE_DIR, filename);
}

export function appGeneratedPath(appName, filename) {
  return path.join(ROOT, appName, 'generated', filename);
}

export function appTokensPath(appName) {
  return appGeneratedPath(appName, 'tokens.css');
}

export function srcDesignTokensPath() {
  return srcStylePath('design-tokens.json');
}
