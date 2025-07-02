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
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

/* ───────── Firebase 초기화 ───────── */
const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, // ← 반드시 *.appspot.com
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
};

// 이미 초기화된 앱이 있으면 재사용
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/* ───────── 서비스 핸들러 ───────── */
export const auth = getAuth(app);
export const db   = getFirestore(app);

// Storage 는 실제 필요할 때만 가져오기 (지연 로딩)
export const getStorageInstance = () => getStorage(app);

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

  /* Storage helpers */
  ref,
  uploadBytes,
  getDownloadURL,
};
