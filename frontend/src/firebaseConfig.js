// src/firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  setDoc,
  deleteField // 1. firestore에서 deleteField를 import 합니다.
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { getFunctions } from 'firebase/functions'; // 1. 이 줄을 추가합니다.

/* ───────── Firebase 초기화 ───────── */
const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
};

// 이미 초기화된 앱이 있으면 재사용
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/* ───────── 서비스 핸들러 ───────── */
export const auth = getAuth(app);
export const db   = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3'); // 2. 이 줄을 추가합니다. (서울 리전)

// Storage는 지연 로딩 + 필요하면 직접 꺼내 씀
export const getStorageInstance = () => getStorage(app);

// *빌드 시 MyReviews·WriteReview에서 static import가 필요하므로
//   기본 storage 객체도 함께 내보냅니다.
export const storage = getStorageInstance();

/* ───────── 자주 쓰는 파이어스토어/스토리지 함수 재수출 ───────── */
export {
  /* Auth helpers */
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,

  /* Firestore helpers */
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  setDoc,
  deleteField, // 2. 여기서 export 해줍니다.

  /* Storage helpers */
  ref,
  uploadBytes,
  getDownloadURL,
};