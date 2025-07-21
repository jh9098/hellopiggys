// vite.config.js (경로 별칭 기능 추가 최종본)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path'; // [추가] Node.js의 'path' 모듈을 임포트

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
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
});
