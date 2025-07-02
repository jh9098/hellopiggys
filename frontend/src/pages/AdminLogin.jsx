import { useState } from 'react'; // useEffect를 import 문에서 제거
import { useNavigate } from 'react-router-dom';
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from '../firebaseConfig';
import './AdminLogin.css';

// 관리자 여부를 확인하는 비동기 함수
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
  const nav = useNavigate();

  // PrivateRoute가 인증 상태 확인을 담당하므로, 
  // AdminLogin 페이지에서는 로그인 로직만 처리합니다.
  // 따라서 useEffect 훅이 필요 없습니다.

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const isAdmin = await checkAdminStatus(cred.user);

      if (isAdmin) {
        nav('/admin/members', { replace: true }); // 로그인 성공 시 기본 페이지로 이동
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