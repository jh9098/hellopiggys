// src/main.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

// ▼▼▼ 디버깅을 위해 이 코드를 추가 ▼▼▼
console.log("읽어온 API 키:", import.meta.env.VITE_FIREBASE_API_KEY);
// ▲▲▲ 추가 완료 ▲▲▲

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);