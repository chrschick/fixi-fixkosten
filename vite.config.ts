import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    // API-Server (yarn dev:server) – Cookies bleiben so same-origin
    proxy: { '/api': 'http://127.0.0.1:5174' },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
})
