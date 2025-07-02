import { useState } from 'react';
import { auth, signInWithEmailAndPassword } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const nav = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    const cred = await signInWithEmailAndPassword(auth, email, pw);
    const token = await cred.user.getIdTokenResult();
    if (token.claims.admin) {
      nav('/admin/reviews');
    } else {
      alert('관리자 권한이 없습니다.');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <h2>관리자 로그인</h2>
      <form onSubmit={handleLogin}>
        <div>
          <input
            type="email"
            placeholder="관리자 이메일"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div style={{ marginTop: '12px' }}>
          <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
          />
        </div>
        <button style={{ marginTop: '12px' }} type="submit">
          로그인
        </button>
      </form>
    </div>
  );
}

export default AdminLogin;
