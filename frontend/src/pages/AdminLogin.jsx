import { useState } from 'react';

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    // TODO: Firebase Auth 혹은 백엔드 /admin/login 연동
    alert(`관리자 로그인: ${email} / ${pw}\n(여기에 실제 로그인 로직 예정)`);
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
