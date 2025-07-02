import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from '../firebaseConfig';
import './AdminLogin.css';              // 선택: 없으면 import 제거

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const nav = useNavigate();

  // 이미 로그인 상태면 바로 관리 페이지로
  onAuthStateChanged(auth, async (u) => {
    if (!u) return;
    const tok = await u.getIdTokenResult();
    if (tok.claims.admin) nav('/admin/review-management', { replace: true });
  });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const tok  = await cred.user.getIdTokenResult();
      if (tok.claims.admin) nav('/admin/review-management');
      else setErr('관리자 권한이 없습니다.');
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="icon" />
      <h2>수리강 리뷰 관리자</h2>
      <form onSubmit={submit}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e)=>setPw(e.target.value)}
          required
        />
        <button>로그인</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}
