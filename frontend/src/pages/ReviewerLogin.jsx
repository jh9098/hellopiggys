// D:\hellopiggy\frontend\src\pages\ReviewerLogin.jsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// ▼▼▼ 1. Firebase 관련 모듈들을 가져옵니다. ▼▼▼
import { auth, db } from '../firebaseConfig';
import { signInAnonymously } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import './ReviewerLogin.css';

export default function ReviewerLogin() {
  const [name, setName] = useState(localStorage.getItem('REVIEWER_NAME') || '');
  const [phone, setPhone] = useState(localStorage.getItem('REVIEWER_PHONE') || '');
  // ▼▼▼ 2. 로그인 진행 중 버튼을 비활성화하기 위한 로딩 상태를 추가합니다. ▼▼▼
  const [isLoading, setIsLoading] = useState(false);

  const nav = useNavigate();

  // ▼▼▼ 3. 로그인 로직(onSubmit)을 Firebase 인증 방식으로 완전히 변경합니다. ▼▼▼
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) return alert('이름과 전화번호를 입력하세요');

    setIsLoading(true); // 로딩 시작

    try {
      // 단계 1: Firebase 익명으로 로그인하여 고유 사용자(uid)를 얻습니다.
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;

      // 단계 2: 얻은 uid를 문서 ID로 사용하여 'users' 컬렉션에 이름과 전화번호를 저장합니다.
      // 이렇게 하면 Firebase uid와 실제 사용자 정보를 연결할 수 있습니다.
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, {
        name: name.trim(),
        phone: phone.trim(),
        uid: uid, // 문서 내에도 uid를 저장해두면 쿼리 시 유용할 수 있습니다.
      }, { merge: true }); // merge: true 옵션은 문서가 이미 있을 경우 덮어쓰지 않고 병합합니다.

      // 단계 3: 사용자 편의를 위해 이름/전화번호는 localStorage에 계속 저장합니다.
      localStorage.setItem('REVIEWER_NAME', name.trim());
      localStorage.setItem('REVIEWER_PHONE', phone.trim());

      // 단계 4: 모든 작업이 성공하면 /my-reviews 페이지로 이동합니다.
      nav('/my-reviews', { replace: true });

    } catch (error) {
      console.error("로그인 및 사용자 정보 저장 실패:", error);
      alert('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false); // 로딩 종료 (성공/실패 여부와 관계없이)
    }
  };

  useEffect(() => {
    if (!name) document.getElementById('input-name')?.focus();
  }, [name]);

  return (
    <div className="login-wrap">
      <div className="icon" />
      <h2 className="login-title">HELLO PIGGY</h2>

      <form onSubmit={onSubmit}>
        <div className="input-with-icon">
          <span className="user-ico" />
          <input
            id="input-name"
            name="name"
            placeholder="이름을 입력해 주세요."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading} // ▼▼▼ 4. 로딩 중일 때 입력 비활성화 ▼▼▼
          />
        </div>

        <div className="input-with-icon">
          <span className="phone-ico" />
          <input
            name="phone"
            placeholder="전화번호를 입력해 주세요."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            required
            disabled={isLoading} // ▼▼▼ 4. 로딩 중일 때 입력 비활성화 ▼▼▼
          />
        </div>

        {/* ▼▼▼ 4. 로딩 상태에 따라 버튼 텍스트와 비활성화 상태 변경 ▼▼▼ */}
        <button className="login-btn" type="submit" disabled={isLoading}>
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
}