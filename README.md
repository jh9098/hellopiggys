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
## Firebase Storage CORS 설정
리포지터리 최상위의 `cors.json` 파일을 참고하여 Firebase Storage를 브라우저에서 직접 사용하려면 버킷에 CORS 규칙을 설정해야 합니다. 예시 `cors.json`을 제공하므로 아래 명령어로 적용하세요.

```bash
# gsutil이 설치되어 있어야 합니다.
# 프로젝트의 Storage 버킷 이름을 환경변수에 지정
BUCKET=your-bucket-name

# CORS 규칙 적용
gsutil cors set cors.json gs://$BUCKET
```

Netlify 등 도메인에서 업로드 시 `https://hellopiggy.netlify.app`가 허용되도록 설정해야 합니다.

