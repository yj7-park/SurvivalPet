import { defineConfig } from 'vite';
import path from 'path';

/**
 * Cloudflare Pages 배포용 단일 플레이어 빌드 설정.
 *
 * 기존 멀티플레이어 소스 코드는 그대로 유지되지만,
 * Firebase 모듈을 no-op stub으로 교체하여 번들에서 제거합니다.
 * (기존 빌드 대비 ~190KB gzip 절약)
 *
 * 빌드: npm run build:pages
 * 출력: dist-pages/
 * Cloudflare Pages 설정:
 *   - Build command : npm run build:pages
 *   - Output directory: dist-pages
 */
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      'firebase/app':      path.resolve(__dirname, 'src/stubs/firebase.ts'),
      'firebase/database': path.resolve(__dirname, 'src/stubs/firebase.ts'),
    },
  },
  build: {
    outDir: 'dist-pages',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
