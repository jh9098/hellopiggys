import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReviewerLogin.css';

export default function ReviewerLogin() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const nav = useNavigate();

  const onSubmit = (e) => {
    e.preventDefault();
    if (!name || !phone) return alert('이름/전화번호를 입력하세요');
    localStorage.setItem('REVIEWER_NAME', name.trim());
    localStorage.setItem('REVIEWER_PHONE', phone.trim());
    nav('/my-reviews', { replace: true });
  };

  return (
    <div className="login-wrap">
      <div className="icon">&nbsp;</div>
      <h2 className="login-title">HELLO PIGGY</h2>

      <form onSubmit={onSubmit}>
        <div className="input-with-icon">
          <span className="user-ico" />
          <input
            placeholder="이름을 입력해 주세요."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="input-with-icon">
          <span className="phone-ico" />
          <input
            placeholder="전화번호를 입력해 주세요."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
          />
        </div>
        <button className="login-btn">로그인</button>
      </form>
    </div>
  );
}
