// vite.config.js (경로 별칭 기능 추가 최종본)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // [추가] Node.js의 'path' 모듈을 임포트

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
});
