/***********************************************
 *  review-platform  ·  backend/index.js
 *  -------------------------------------------
 *  - Firebase Admin SDK 초기화
 *  - 이미지 업로드(API /api/upload)
 *  - 리뷰 CRUD (목록·상세·등록)
 *  - 관리자 인증(adminAuth 미들웨어)
 ***********************************************/

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

// .env 로드
dotenv.config();

/* ---------- Firebase Admin 초기화 ---------- */
const serviceAccountPath =
  process.env.SERVICE_ACCOUNT_KEY_PATH || './serviceAccountKey.json';

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`❌  serviceAccountKey.json not found: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // ex) hellopiggy-8be01.firebasestorage.app
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

/* ---------- Express 앱 ---------- */
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

/* ---------- 관리자 인증 미들웨어 ---------- */
import adminAuth from './middleware/adminAuth.js';

/* ---------- 헬스 체크 ---------- */
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

/* ============================================================
 *  리뷰 API
 * ========================================================== */

/* 리뷰 목록 (관리자 전용) */
app.get('/api/reviews', adminAuth, async (_req, res) => {
  try {
    const snap = await db
      .collection('reviews')
      .orderBy('createdAt', 'desc')
      .get();
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json(list);
  } catch (err) {
    console.error('[GET] /api/reviews', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* 리뷰 상세 (관리자 전용) */
app.get('/api/reviews/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    /* 1) 문서 ID 직접 조회 */
    const doc = await db.collection('reviews').doc(id).get();
    if (doc.exists) return res.json({ id: doc.id, ...doc.data() });

    /* 2) uuidReview 필드로 조회 (호환) */
    const snap = await db
      .collection('reviews')
      .where('uuidReview', '==', id)
      .limit(1)
      .get();
    if (!snap.empty) {
      const d = snap.docs[0];
      return res.json({ id: d.id, ...d.data() });
    }

    res.status(404).json({ error: 'review not found' });
  } catch (err) {
    console.error('[GET] /api/reviews/:id', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* 리뷰 등록 (사용자) */
app.post('/api/reviews', async (req, res) => {
  try {
    const data = req.body; // 모든 필드 + 이미지 URL 포함
    const ref = await db.collection('reviews').add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: ref.id });
  } catch (err) {
    console.error('[POST] /api/reviews', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ============================================================
 *  이미지 업로드 API
 * ========================================================== */
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  try {
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `reviewImages/${Date.now()}_${req.file.originalname}`;

    /* Firebase Storage 업로드 */
    const file = bucket.file(filename);
    await file.save(req.file.buffer, { contentType: req.file.mimetype });

    /* 서명 URL(1h) 발급 */
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });

    res.json({ url: signedUrl }); // 프론트엔드는 이 URL을 Firestore에 저장
  } catch (err) {
    console.error('[POST] /api/upload', err);
    res.status(500).json({ error: 'upload failed' });
  }
});

/* 계정 병합 (관리자 전용) */
app.post('/api/merge-accounts', adminAuth, async (req, res) => {
  const { destUid, destPhone, sourceUid, sourcePhone } = req.body || {};
  if (!destUid || !destPhone || !sourceUid || !sourcePhone) {
    return res.status(400).json({ error: 'missing params' });
  }
  try {
    const destUserRef = db.collection('users').doc(destUid);
    const sourceUserRef = db.collection('users').doc(sourceUid);
    const [destUserSnap, sourceUserSnap, destPhoneSnap, sourcePhoneSnap] = await Promise.all([
      destUserRef.get(),
      sourceUserRef.get(),
      db.collection('users_by_phone').doc(destPhone).get(),
      db.collection('users_by_phone').doc(sourcePhone).get(),
    ]);
    if (!destUserSnap.exists || !sourceUserSnap.exists) {
      return res.status(404).json({ error: 'user not found' });
    }
    if (!destPhoneSnap.exists || !sourcePhoneSnap.exists) {
      return res.status(404).json({ error: 'phone not found' });
    }
    if (destPhoneSnap.data().uid !== destUid || sourcePhoneSnap.data().uid !== sourceUid) {
      return res.status(400).json({ error: 'uid mismatch' });
    }

    const updateCollection = async (col) => {
      const snap = await db.collection(col).where('mainAccountId', '==', sourceUid).get();
      const batch = db.batch();
      snap.forEach((d) => batch.update(d.ref, { mainAccountId: destUid }));
      await batch.commit();
    };

    await updateCollection('reviews');
    await updateCollection('subAccounts');
    await updateCollection('addresses');

    await sourceUserRef.delete();
    await db.collection('users_by_phone').doc(sourcePhone).delete();

    res.json({ success: true });
  } catch (err) {
    console.error('[POST] /api/merge-accounts', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ---------- 서버 스타트 ---------- */
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
