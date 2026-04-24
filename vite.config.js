import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFrontendViteInputs } from './tooling/scripts/frontend-route-utils.js';

function copyTokenShowcaseScript() {
    return {
        name: 'copy-token-showcase-script',
        generateBundle() {
            const sourcePath = fileURLToPath(new URL('./showcase/token-showcase.js', import.meta.url));
            this.emitFile({
                type: 'asset',
                fileName: 'showcase/token-showcase.js',
                source: readFileSync(sourcePath, 'utf8')
            });
        }
    };
}

export default defineConfig({
    root: '.',
    plugins: [copyTokenShowcaseScript()],
    server: {
        port: 5173,
        open: '/demo/'
    },
    resolve: {
        alias: {
            'src': '/src'
        }
    },
    build: {
        target: 'es2020',
        rollupOptions: {
            input: createFrontendViteInputs(),
            external: [
                '@capacitor/filesystem',
                '@capacitor/camera',
                '@capacitor/local-notifications'
            ]
        }
    }
});
