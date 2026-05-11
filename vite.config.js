import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
    plugins: [react(), viteSingleFile()],
    base: './',
    build: {
        target: 'es2020',
        cssCodeSplit: false,
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        rollupOptions: {
            output: { inlineDynamicImports: true },
        },
    },
});
