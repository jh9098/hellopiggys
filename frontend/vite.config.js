// vite.config.js (경로 별칭 기능 추가 최종본)

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // [추가] Node.js의 'path' 모듈을 임포트

export default defineConfig({
  plugins: [react()],
  // [추가] resolve.alias 설정을 추가하여 경로 별칭을 정의합니다.
  resolve: {
    alias: [
      // 이제 프로젝트 어디서든 '@/components/...' 같은 경로를 사용할 수 있습니다.
      { find: '@', replacement: path.resolve(__dirname, 'src') },
    ],
  },
});