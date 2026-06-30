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
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(process.env['VITE_APP_VERSION'] ?? '0.1.0'),
    'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(process.env['GIT_COMMIT'] ?? 'dev'),
    'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(
      process.env['BUILD_TIMESTAMP'] ?? new Date().toISOString(),
    ),
    'import.meta.env.VITE_GIT_REPOSITORY': JSON.stringify(
      process.env['GIT_REPOSITORY'] ?? 'https://github.com/vinylly/vinylly',
    ),
  },
  clearScreen: false,
});
