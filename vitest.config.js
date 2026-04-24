import { defineConfig, configDefaults } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    resolve: {
        alias: {
            '@capacitor/filesystem': fileURLToPath(new URL('./tests/helpers/capacitor-filesystem.stub.js', import.meta.url)),
            '@capacitor/camera': fileURLToPath(new URL('./tests/helpers/capacitor-camera.stub.js', import.meta.url)),
            '@capacitor/local-notifications': fileURLToPath(new URL('./tests/helpers/capacitor-local-notifications.stub.js', import.meta.url))
        }
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/helpers/storage-polyfill.js'],
        exclude: [...configDefaults.exclude, 'tests/browser/**']
    }
});
