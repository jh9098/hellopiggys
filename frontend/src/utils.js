export const toAbsoluteUrl = (url) => {
  if (!url) return '';
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
};

// 고유한 상품 번호 발급
import { db, doc, runTransaction } from './firebaseConfig';

export const getNextSerialNumber = async () => {
  const counterRef = doc(db, 'counters', 'productSerial');
  const newNumber = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const next = current + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    return next;
  });
  return newNumber;
};
