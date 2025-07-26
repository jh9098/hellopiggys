// frontend/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// 빌드 시점 버전 (강제 리로드용)
const BUILD_ID = new Date().toISOString();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',          // 새 SW 있으면 자동 업데이트
      injectRegister: 'auto',
      devOptions: { enabled: false },      // dev 에서는 SW 끔 (권장)
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        // 필요시 allowlist 추가: navigateFallbackAllowlist: [/^\/$/, /^\/seller/, /^\/admin/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/developers\.kakao\.com\/sdk\/js\/kakao\.js$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'kakao-sdk' },
          },
          {
            urlPattern: /^https:\/\/js\.tosspayments\.com\/v1\/payment-widget$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'toss-sdk' },
          },
          {
            // Firebase 실시간 통신 캐싱 안 함
            urlPattern: /^https:\/\/(securetoken|identitytoolkit|firestore)\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: 'Review Platform',
        short_name: 'Review',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: [{ find: '@', replacement: path.resolve(__dirname, 'src') }],
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
