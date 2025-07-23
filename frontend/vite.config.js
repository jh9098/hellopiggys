// frontend/vite.config.js (PWA 오류 해결 최종본)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // [수정] workbox 설정을 추가하여 PWA 파일 캐싱 제한을 늘립니다.
      workbox: {
        // 서비스 워커가 오프라인 사용을 위해 미리 캐싱할 파일의 최대 크기를 설정합니다.
        // 기본값 2MB에서 5MB로 상향 조정합니다. (5 * 1024 * 1024)
        maximumFileSizeToCacheInBytes: 5000000,
      },
      manifest: {
        name: 'Review Platform',
        short_name: 'Review',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
      },
    },
  },
});