import { defineConfig } from 'vite';

export default defineConfig({
    root: 'demo',
    server: {
        port: 5173,
        open: '/'
    },
    resolve: {
        alias: {
            'src': '/src'
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
