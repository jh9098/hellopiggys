// src/components/LoginModal.jsx

import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db, doc, setDoc, getDoc } from '../firebaseConfig';

export default function LoginModal({ onClose, onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true); // true: 로그인 뷰, false: 회원가입 뷰

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const emailForAuth = `${phone.trim()}@hellopiggy.com`; // 전화번호를 이메일 형식으로 변환

    if (isLoginView) {
      // --- 로그인 로직 ---
      try {
        const userCredential = await signInWithEmailAndPassword(auth, emailForAuth, password);
        onLoginSuccess(userCredential.user); // 성공 시 부모 컴포넌트에 user 객체 전달
        onClose();
      } catch (err) {
        console.error("로그인 실패:", err.code);
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
          setError('전화번호 또는 비밀번호가 올바르지 않습니다.');
        } else {
          setError('로그인 중 오류가 발생했습니다.');
        }
      }
    } else {
      // --- 회원가입 로직 ---
      try {
        if (!name.trim()) return setError('이름을 입력해주세요.');
        // Firestore에 이미 해당 전화번호로 가입한 유저가 있는지 확인 (선택적이지만 권장)
        const userByPhoneRef = doc(db, 'users_by_phone', phone.trim());
        const docSnap = await getDoc(userByPhoneRef);
        if (docSnap.exists()) {
          return setError('이미 등록된 전화번호입니다. 로그인해주세요.');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, emailForAuth, password);
        const { user } = userCredential;
        
        // 'users' 컬렉션에 사용자 정보 저장
        await setDoc(doc(db, 'users', user.uid), {
          name: name.trim(),
          phone: phone.trim(),
          uid: user.uid,
        });
        
        // 전화번호 중복 가입 방지를 위한 별도 컬렉션
        await setDoc(userByPhoneRef, { uid: user.uid });

        alert('회원가입이 완료되었습니다. 자동으로 로그인됩니다.');
        onLoginSuccess(user);
        onClose();
      } catch (err) {
        console.error("회원가입 실패:", err.code);
        if (err.code === 'auth/weak-password') {
          setError('비밀번호는 6자리 이상이어야 합니다.');
        } else if (err.code === 'auth/email-already-in-use') {
          setError('이미 등록된 전화번호입니다. 로그인해주세요.');
        } else {
          setError('회원가입 중 오류가 발생했습니다.');
        }
      }
    }
    setSubmitting(false);
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✖</button>
        
        <form onSubmit={handleSubmit}>
          <h3>{isLoginView ? '로그인' : '회원가입'}</h3>
          
          {!isLoginView && (
            <input type="text" placeholder="이름" value={name} onChange={e => setName(e.target.value)} required />
          )}
          <input type="tel" placeholder="전화번호 ('-' 없이 입력)" value={phone} onChange={e => setPhone(e.target.value)} required />
          <input type="password" placeholder="비밀번호 (6자리 이상)" value={password} onChange={e => setPassword(e.target.value)} required />
          
          <button type="submit" disabled={submitting}>
            {submitting ? '처리 중...' : (isLoginView ? '로그인' : '회원가입')}
          </button>
          {error && <p className="error-msg">{error}</p>}
        </form>

        <div className="view-toggle">
          {isLoginView ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
          <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }}>
            {isLoginView ? '회원가입' : '로그인'}
          </button>
        </div>
      </div>
    </div>
  );
}