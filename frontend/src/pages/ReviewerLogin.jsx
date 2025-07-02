import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ReviewerLogin.css';                              // ← 스타일 파일(선택)
                                                            // 없으면 이 줄 삭제
export default function ReviewerLogin() {
  /* ▸ 1. 이름·전화번호를 localStorage 에서 미리 읽어와 상태 초기화 */
  const [name, setName]   = useState(localStorage.getItem('REVIEWER_NAME')   || '');
  const [phone, setPhone] = useState(localStorage.getItem('REVIEWER_PHONE') || '');

  const nav = useNavigate();

  /* ▸ 2. 제출 = localStorage 저장 → /my-reviews 이동 */
  const onSubmit = (e) => {
    e.preventDefault();
    if (!name || !phone) return alert('이름과 전화번호를 입력하세요');

    localStorage.setItem('REVIEWER_NAME',  name.trim());
    localStorage.setItem('REVIEWER_PHONE', phone.trim());

    nav('/my-reviews', { replace: true });
  };

  /* ▸ 3. 페이지 첫 로드 시 이름이 비어 있으면 입력창에 포커스 */
  useEffect(() => {
    if (!name) document.getElementById('input-name')?.focus();
  }, [name]);

  /* ▸ 4. UI */
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
          />
        </div>

        <button className="login-btn" type="submit">
          로그인
        </button>
      </form>
    </div>
  );
}
