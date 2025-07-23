import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from 'firebase/auth';
import { auth, db, doc, setDoc, getDoc } from '../firebaseConfig';
import './ReviewerLogin.css';
import { Button } from '@/components/ui/button';

// [추가] 푸터 컴포넌트
const Footer = () => {
  return (
    <footer className="bg-[#FFC0CB] text-white p-6 md:p-8 w-full">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-xs md:text-sm">
        
        {/* 좌측: 회사 정보 */}
        <div className="space-y-1.5">
          <p><strong>상호명 :</strong> 아이언마운틴컴퍼니</p>
          <p><strong>대표자 :</strong> 채종문</p>
          <p><strong>소재지 :</strong> 서울특별시 노원구 덕릉로82길 25, 3층 A233호(중계동, 동우상가)</p>
          <p><strong>사업자등록번호 :</strong> 221-30-61464</p>
          <p><strong>통신판매업신고 :</strong> 제 2023-서울노원-1246 호</p>
        </div>

        {/* 중앙: 고객센터 */}
        <div className="space-y-2 md:text-center">
          <p className="font-bold text-base">고객센터 | 전자금융거래분쟁처리담당</p>
          <p className="font-bold text-3xl my-2">010-4889-3380</p>
          <p>chaism123@naver.com</p>
        </div>

        {/* 우측: 계좌 정보 및 링크 */}
        <div className="space-y-1.5 md:text-right">
          <p><strong>계좌은행 :</strong> 국민은행</p>
          <p><strong>계좌번호 :</strong> 289357-00-006049</p>
          <p><strong>계좌명 :</strong> 아이언마운틴컴퍼니</p>
          <div className="pt-4 space-y-1">
            <a href="#!" className="block hover:underline">... 이용약관</a>
            <a 
              href="https://hellopiggys.netlify.app/privacy-policy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:underline"
            >
              ... 개인정보처리방침
            </a>
          </div>
        </div>
      </div>
      <div className="text-center mt-8 pt-6 border-t border-white/30 text-xs">
        © All rights reserved. Made by 아이언마운틴컴퍼니.
      </div>
    </footer>
  );
};


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
        await signInWithEmailAndPassword(auth, emailForAuth, password);
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
    // [수정] 전체 레이아웃을 flex 컨테이너로 감싸 푸터가 하단에 위치하도록 함
    <div className="flex flex-col min-h-screen">
      <main className="flex-grow">
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
            <Button className="login-btn" type="submit" disabled={submitting}>
              {submitting ? '처리 중...' : isLoginView ? '로그인' : '회원가입'}
            </Button>
            {error && <p style={{color:'red', marginTop:'10px'}}>{error}</p>}
          </form>
          <div className="view-toggle" style={{ marginTop: '20px' }}>
            {isLoginView ? '계정이 없으신가요?' : '이미 계정이 있으신가요?'}
            <Button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} style={{ marginLeft: '10px' }} variant="link">
              {isLoginView ? '회원가입' : '로그인'}
            </Button>
          </div>
          <Button onClick={handleKakaoLogin} style={{ marginTop: '20px' }}>
            카카오 로그인
          </Button>
        </div>
      </main>
      
      {/* [추가] Footer 컴포넌트 렌더링 */}
      <Footer />
    </div>
  );
}