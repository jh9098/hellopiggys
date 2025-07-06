// D:\hellopiggy\frontend\src\pages\ReviewerLogin.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import { auth, db, functions, doc, setDoc } from '../firebaseConfig';
import './ReviewerLogin.css';

export default function ReviewerLogin() {
  const [name, setName] = useState(localStorage.getItem('REVIEWER_NAME') || '');
  const [phone, setPhone] = useState(localStorage.getItem('REVIEWER_PHONE') || '');
  const [isLoading, setIsLoading] = useState(false);

  const nav = useNavigate();

  // ▼▼▼ 로그인 로직(onSubmit)을 AccountModal과 동일한 커스텀 인증 방식으로 변경합니다. ▼▼▼
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) return alert('이름과 전화번호를 입력하세요');

    setIsLoading(true);

    try {
      // 1. Firebase Function을 가리킵니다.
      const createTokenFunction = httpsCallable(functions, 'createCustomToken');
      
      // 2. 함수에 이름과 전화번호를 전달하여 호출합니다.
      const result = await createTokenFunction({ name: name, phone: phone });
      
      // 3. 서버로부터 받은 커스텀 토큰으로 로그인합니다.
      const { token, uid } = result.data; // uid는 '이름_전화번호' 형태가 됩니다.
      await signInWithCustomToken(auth, token);
      
      // 4. users 컬렉션에 정보를 저장(업데이트)합니다.
      await setDoc(doc(db, 'users', uid), {
        name: name.trim(),
        phone: phone.trim(),
        uid: uid,
      }, { merge: true });

      // 5. 사용자 편의를 위해 이름/전화번호를 localStorage에 저장합니다.
      localStorage.setItem('REVIEWER_NAME', name.trim());
      localStorage.setItem('REVIEWER_PHONE', phone.trim());

      // 6. 모든 작업이 성공하면 /my-reviews 페이지로 이동합니다.
      nav('/my-reviews', { replace: true });

    } catch (error) {
      console.error("커스텀 로그인 실패:", error);
      alert('로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
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
            disabled={isLoading}
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
            disabled={isLoading}
          />
        </div>
        <button className="login-btn" type="submit" disabled={isLoading}>
          {isLoading ? '로그인 중...' : '로그인'}
        </button>
      </form>
    </div>
  );
} 