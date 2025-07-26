// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// PWA 업데이트 핸들러
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 새 서비스워커 -> 바로 적용 & 리로드
    updateSW(true);
  },
  onOfflineReady() {
    // 오프라인 준비 완료시 필요하면 토스트 등
  },
});

// 빌드 버전 변경 시 1회 리로드 (백업 안전장치)
const BID = __BUILD_ID__;
const prev = localStorage.getItem('BUILD_ID');
if (prev && prev !== BID) {
  localStorage.setItem('BUILD_ID', BID);
  location.reload();
} else {
  localStorage.setItem('BUILD_ID', BID);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
