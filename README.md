# Firebase Review Platform (Vite + Express)

## 구조
- **frontend/**: Vite + React 앱 (사용자 & 관리자 화면)
- **backend/**: Express API 서버 (Firebase Admin SDK)

## 시작 방법
1. Firebase 프로젝트 생성 후 인증·Firestore·Storage 활성화.
2. **frontend/.env.example**를 `.env`로 복사하고 Firebase Web 설정값 입력.
3. **backend/.env.example**를 `.env`로 복사하고 서비스 계정 JSON 경로, 버킷 등 입력.
4. 의존성 설치:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```
5. 서버 실행:
   ```bash
   cd backend && npm start
   cd ../frontend && npm run dev
   ```
6. 브라우저에서 http://localhost:5173 에 접속.

## 더미 데이터
`backend/dummyData.json`에 예시 리뷰/관리자 계정이 포함돼 있습니다.
`node backend/seed.js`로 Firestore에 샘플 리뷰를 입력할 수 있습니다.