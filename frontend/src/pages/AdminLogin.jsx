import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from '../firebaseConfig';

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    const cred = await signInWithEmailAndPassword(auth, email, pw);
    const token = await cred.user.getIdTokenResult();
    if (token.claims.admin) nav('/admin/reviews');
    else alert('관리자 권한이 없습니다.');
  };

  /* 간단 JSX */
  return (
    <div style={{ padding: 24 }}>
      <h2>관리자 로그인</h2>
      <form onSubmit={onSubmit}>
        <input
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        <button>로그인</button>
      </form>
    </div>
  );
}

export default AdminLogin;   // ✅ 한 번만 남기고 중복 제거
