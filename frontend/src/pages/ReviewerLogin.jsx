import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, db, doc, setDoc, getDoc } from '../firebaseConfig';
import './ReviewerLogin.css';

export default function ReviewerLogin() {
  const navigate = useNavigate();
  const [isLoginView, setIsLoginView] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleKakaoLogin = () => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: import.meta.env.VITE_KAKAO_REST_KEY,
      redirect_uri: import.meta.env.VITE_KAKAO_REDIRECT_URI,
      scope: 'profile_nickname,phone_number',
    });
    window.location.href = `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const emailForAuth = `${phone.trim()}@hellopiggy.com`;
    try {
      if (isLoginView) {
        const cred = await signInWithEmailAndPassword(auth, emailForAuth, password);
        navigate('/my-reviews', { replace: true });
      } else {
        if (!name.trim()) {
          setError('이름을 입력해주세요.');
          setSubmitting(false);
          return;
        }
        const userByPhoneRef = doc(db, 'users_by_phone', phone.trim());
        const snap = await getDoc(userByPhoneRef);
        if (snap.exists()) {
          setError('이미 등록된 전화번호입니다. 로그인해주세요.');
          setSubmitting(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('비밀번호가 일치하지 않습니다.');
          setSubmitting(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, emailForAuth, password);
        await setDoc(doc(db, 'users', cred.user.uid), {
          name: name.trim(),
          phone: phone.trim(),
          uid: cred.user.uid,
        });
        await setDoc(userByPhoneRef, { uid: cred.user.uid });
        navigate('/my-reviews', { replace: true });
      }
    } catch (err) {
      console.error('로그인 오류:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('전화번호 또는 비밀번호가 올바르지 않습니다.');
      } else if (err.code === 'auth/weak-password') {
        setError('비밀번호는 6자리 이상이어야 합니다.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('이미 등록된 전화번호입니다. 로그인해주세요.');
      } else {
        setError('처리 중 오류가 발생했습니다.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="icon" />
      <h2 className="login-title">HELLO PIGGY</h2>
      <form onSubmit={handleSubmit}>
        {!isLoginView && (
          <div className="input-with-icon">
            <span className="user-ico" />
            <input
              type="text"
              name="name"
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}
        <div className="input-with-icon">
          <span className="phone-ico" />
          <input
            type="tel"
            name="phone"
            placeholder="전화번호 ('-' 없이 입력)"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
            required
          />
        </div>
        <div className="input-with-icon">
          <input
            type="password"
            name="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {!isLoginView && (
          <div className="input-with-icon">
            <input
              type="password"
              name="confirmPassword"
              placeholder="비밀번호 재입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
        )}
        <button className="login-btn" type="submit" disabled={submitting}>
          {submitting ? '처리 중...' : isLoginView ? '로그인' : '회원가입'}
        </button>
        {error && <p style={{color:'red', marginTop:'10px'}}>{error}</p>}
      </form>
      <div className="view-toggle" style={{ marginTop: '20px' }}>
        {isLoginView ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
        <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} style={{ marginLeft: '10px' }}>
          {isLoginView ? '회원가입' : '로그인'}
        </button>
      </div>
      <button onClick={handleKakaoLogin} style={{ marginTop: '20px' }}>
        카카오 로그인
      </button>
    </div>
  );
}
