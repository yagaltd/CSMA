import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'es2020',
        minify: 'terser',
        terserOptions: {
            compress: {
                drop_console: false, // Keep console for debugging
                drop_debugger: true
            }
        },
        rollupOptions: {
            external: [
                // Platform-specific modules that are only available at runtime
                '@capacitor/filesystem',
                '@capacitor/camera',
                '@capacitor/local-notifications'
            ],
            output: {
                format: 'es',
                manualChunks: {
                    // Separate runtime from app code
                    runtime: [
                        './src/runtime/EventBus.js',
                        './src/runtime/ServiceManager.js',
                        './src/runtime/Contracts.js',
                        './src/runtime/MetaManager.js',
                        './src/runtime/LogAccumulator.js'
                    ]
                }
            }
        }
    },
    server: {
        port: 5173,
        open: true
    }
});
