import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          firebase: ['firebase/app', 'firebase/database'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
