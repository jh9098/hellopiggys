// src/pages/auth/SellerSignup.jsx (클라이언트에서 직접 API 호출하는 최종본)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // [추가] axios 라이브러리를 직접 임포트해야 합니다.

// [수정] 우리 프로젝트의 중앙 firebaseConfig.js 에서 필요한 것만 가져옵니다.
import {
  auth, db,
  createUserWithEmailAndPassword,
  doc, setDoc, collection, query, where, getDocs, serverTimestamp
} from '../../firebaseConfig';

export default function SellerSignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bNo, setBNo] = useState('');
  const [referrerId, setReferrerId] = useState('');
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const navigate = useNavigate();

  const handleSignUpAndVerify = async (e) => {
    e.preventDefault();
    if (!email || !password || !bNo || !name || !phone || !username || !nickname) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    setIsVerifying(true);
    try {
      // --- 데이터베이스 중복 확인 (기존과 동일) ---
      const emailQuery = query(collection(db, 'sellers'), where('email', '==', email));
      if (!(await getDocs(emailQuery)).empty) throw new Error('이미 사용 중인 이메일입니다.');

      const bNoQuery = query(collection(db, 'sellers'), where('businessInfo.b_no', '==', bNo));
      if (!(await getDocs(bNoQuery)).empty) throw new Error('이미 등록된 사업자 번호입니다.');

      const phoneQuery = query(collection(db, 'sellers'), where('phone', '==', phone));
      if (!(await getDocs(phoneQuery)).empty) throw new Error('이미 사용 중인 전화번호입니다.');

      const usernameQuery = query(collection(db, 'sellers'), where('username', '==', username));
      if (!(await getDocs(usernameQuery)).empty) throw new Error('이미 사용 중인 ID입니다.');

      const nicknameQuery = query(collection(db, 'sellers'), where('nickname', '==', nickname));
      if (!(await getDocs(nicknameQuery)).empty) throw new Error('이미 사용 중인 닉네임입니다.');

      // --- 국세청 API 직접 호출 (수정된 부분) ---
      const serviceKey = import.meta.env.VITE_NTS_API_SERVICE_KEY;
      if (!serviceKey) {
        throw new Error("API 키가 설정되지 않았습니다. Netlify 환경 변수를 확인하세요.");
      }
      
      const encodedKey = encodeURIComponent(serviceKey);
      const apiUrl = `https://api.odcloud.kr/api/nts-businessman/v1/status?serviceKey=${encodedKey}`;
      
      const apiResponse = await axios.post(
        apiUrl,
        { b_no: [bNo] },
        { headers: { "Content-Type": "application/json" } }
      );
      
      const businessApiResponse = apiResponse.data;
      const businessData = businessApiResponse?.data?.[0];

      if (businessData && businessData.b_stt_cd === '01') {
        // --- Firebase 계정 생성 및 데이터 저장 (기존과 동일) ---
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        const user = cred.user;
        await setDoc(doc(db, 'sellers', user.uid), {
          uid: user.uid,
          email, name, phone, username, nickname, referrerId,
          businessInfo: businessData,
          isVerified: true,
          paymentStatus: 'unpaid',
          paymentAmount: 50000,
          role: 'seller',
          createdAt: serverTimestamp(),
        });
        alert(`${businessData.tax_type} 사업자 인증 및 가입이 완료되었습니다.`);
        navigate('/seller-login'); // 가입 후 로그인 페이지로 이동하여 다시 로그인하도록 유도
      } else {
        alert(`인증 실패: ${businessData?.b_stt || '국세청 API 응답에 오류가 있습니다.'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`가입 과정에서 오류가 발생했습니다: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>판매자 회원가입</h1>
      <form onSubmit={handleSignUpAndVerify}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="이름" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="이메일" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="전화번호" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={bNo} onChange={e => setBNo(e.target.value.replace(/-/g,''))} placeholder="사업자등록번호('-' 제외)" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={username} onChange={e => setUsername(e.target.value)} placeholder="ID" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="닉네임" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="PW" required style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <input value={referrerId} onChange={e => setReferrerId(e.target.value)} placeholder="추천인 ID (선택)" style={{ width:'100%', padding:'8px', marginBottom:'10px' }} />
        <button type="submit" disabled={isVerifying} style={{ width:'100%', padding:'10px' }}>
          {isVerifying ? '인증 중...' : '가입하기'}
        </button>
      </form>
    </div>
  );
}
