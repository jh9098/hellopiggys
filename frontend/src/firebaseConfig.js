// src/firebaseConfig.js (httpsCallable 추가 최종본)

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
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
  deleteField,
  onSnapshot,
  writeBatch,
  increment,
  arrayRemove,
  documentId,
  runTransaction,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';

// [1. 수정] firebase/functions에서 httpsCallable를 추가로 임포트합니다.
import { getFunctions, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey:             import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:         import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:          import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:  import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:              import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
export const functions = getFunctions(app, 'asia-northeast3');
export const storage = getStorage(app);

// 자주 쓰는 함수 재수출
export {
  // Auth
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,

  // Firestore
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
  deleteField,
  onSnapshot,
  writeBatch,
  increment,
  arrayRemove,
  documentId,
  runTransaction,

  // Storage
  ref,
  uploadBytes,
  getDownloadURL,

  // [2. 수정] Functions 관련 함수를 export 목록에 추가합니다.
  httpsCallable,
};