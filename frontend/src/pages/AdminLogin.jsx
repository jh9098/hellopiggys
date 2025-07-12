// src/pages/AdminLogin.jsx (리디렉션 경로 수정)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from '../firebaseConfig';
import './AdminLogin.css';

const checkAdminStatus = async (user) => {
  if (!user) return false;
  try {
    const adminDocRef = doc(db, 'admins', user.uid);
    const adminDocSnap = await getDoc(adminDocRef);
    return adminDocSnap.exists() && adminDocSnap.data().role === 'admin';
  } catch (error) {
    console.error("관리자 상태 확인 중 오류:", error);
    return false;
  }
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const isAdmin = await checkAdminStatus(cred.user);

      if (isAdmin) {
        // [수정] 구체적인 페이지 대신, 관리자 메인 경로로 이동
        // App.jsx의 index route가 올바른 페이지로 다시 리디렉션해 줄 것임
        navigate('/admin', { replace: true }); 
      } else {
        await auth.signOut();
        setErr('관리자 권한이 없습니다.');
      }
    } catch (e) {
      if (e.code === 'auth/invalid-credential') {
        setErr('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setErr('로그인 중 오류가 발생했습니다.');
      }
      console.error(e);
    }
  };

  return (
    <div className="admin-login-wrap">
      <div className="icon" />
      <h2>수리강 리뷰 관리자</h2>
      <form onSubmit={submit}>
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button type="submit">로그인</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}