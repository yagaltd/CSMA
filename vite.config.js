import { defineConfig } from 'vite';

export default defineConfig({
    root: 'demo',
    server: {
        port: 5173,
        open: '/examples/landing/'
    },
    resolve: {
        alias: {
            'library': '/library'
        }
    },
    build: {
        target: 'es2020',
        rollupOptions: {
            external: [
                '@capacitor/filesystem',
                '@capacitor/camera',
                '@capacitor/local-notifications'
            ]
        }
    }
});
