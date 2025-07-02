// src/pages/AdminLogin.jsx (전체 수정 코드)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from '../firebaseConfig';
import './AdminLogin.css';

const checkAdminStatus = async (user) => {
  if (!user) return false;
  
  try {
    const adminDocRef = doc(db, 'admins', user.uid); // 'admins' 컬렉션에서 사용자 uid로 문서 참조
    const adminDocSnap = await getDoc(adminDocRef);
    
    // 문서가 존재하고, role 필드가 'admin'이면 true 반환
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
  const nav = useNavigate();

  // 이미 로그인 상태인지 확인
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isAdmin = await checkAdminStatus(user);
        if (isAdmin) {
          nav('/admin/review-management', { replace: true });
        } else {
          setLoading(false); // 관리자가 아니면 로그인 폼 표시
        }
      } else {
        setLoading(false); // 로그인 상태가 아니면 폼 표시
      }
    });
    return () => unsubscribe(); // 클린업
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const isAdmin = await checkAdminStatus(cred.user);

      if (isAdmin) {
        nav('/admin/review-management');
      } else {
        await auth.signOut(); // 관리자가 아니면 즉시 로그아웃 처리
        setErr('관리자 권한이 없습니다.');
      }
    } catch (e) {
      // Firebase 인증 에러 코드에 따라 더 친절한 메시지 표시 가능
      if (e.code === 'auth/invalid-credential') {
        setErr('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setErr('로그인 중 오류가 발생했습니다.');
      }
      console.error(e);
    }
  };

  if (loading) {
    return <p style={{textAlign: 'center', padding: '50px'}}>인증 상태 확인 중...</p>;
  }

  return (
    <div className="admin-login-wrap">
      <div className="icon" />
      <h2>수리강 리뷰 관리자</h2>
      <form onSubmit={submit}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        <button type="submit">로그인</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>
  );
}