import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/discogs-api': {
        target: 'https://api.discogs.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/discogs-api/, ''),
      },
      '/discogs-img': {
        target: 'https://i.discogs.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/discogs-img/, ''),
      },
      '/coverartarchive': {
        target: 'https://coverartarchive.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/coverartarchive/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  clearScreen: false,
});
