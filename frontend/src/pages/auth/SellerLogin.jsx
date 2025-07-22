// src/pages/auth/SellerLogin.jsx (Vite 환경에 맞게 완벽 수정된 최종본)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { 
  auth, db, functions, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  doc, setDoc, collection, query, where, getDocs, serverTimestamp 
} from '../../firebaseConfig';

export default function SellerLoginPage() {
  // 로그인용 state
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showSignup, setShowSignup] = useState(false);

  // 회원가입용 state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [bNo, setBNo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nickname, setNickname] = useState('');
  const [referrerId, setReferrerId] = useState('');

  const [isVerifying, setIsVerifying] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate(); // [수정] useRouter를 useNavigate로 완전히 교체

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const q = query(collection(db, 'sellers'), where('username', '==', loginId));
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('존재하지 않는 ID입니다.');
      const { email } = snap.docs[0].data();
      await signInWithEmailAndPassword(auth, email, loginPassword);
      navigate('/seller/dashboard'); // [수정] router.push -> navigate
    } catch (error) {
      alert('아이디/비밀번호를 다시 입력해 주세요.');
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    alert('로그아웃 되었습니다.');
  };

  const handleSignUpAndVerify = async (e) => {
    e.preventDefault();
    if (!username || !password || !name || !bNo || !email || !phone || !nickname) {
      alert('추천인 ID를 제외한 모든 필드를 입력해주세요.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setIsVerifying(true);

    try {
      const emailQuery = query(collection(db, 'sellers'), where('email', '==', email));
      if (!(await getDocs(emailQuery)).empty) throw new Error('이미 사용 중인 이메일입니다.');

      const bNoQuery = query(collection(db, 'sellers'), where('businessInfo.b_no', '==', bNo));
      if (!(await getDocs(bNoQuery)).empty) throw new Error('이미 등록된 사업자 번호입니다.');

      // [수정] Firebase Functions 호출 방식으로 변경
      const verifyBusiness = httpsCallable(functions, 'verifyBusiness');
      const result = await verifyBusiness({ b_no: bNo });
      const businessData = result.data;

      if (businessData.success && businessData.b_stt_cd === '01') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "sellers", user.uid), {
          uid: user.uid,
          username, email, name, phone, nickname, referrerId,
          businessInfo: businessData, // API 응답 전체를 저장
          isVerified: true,
          paymentStatus: 'unpaid',
          paymentAmount: 50000,
          role: 'seller',
          createdAt: serverTimestamp(),
        });
        
        alert(`${businessData.tax_type} 사업자 인증 및 가입이 완료되었습니다.`);
        navigate('/seller/dashboard'); // [수정] router.push -> navigate

      } else {
        alert(`인증 실패: ${businessData.b_stt || businessData.message || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error(error);
      alert(`가입 과정에서 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto' }}>
      <h1>판매자 센터</h1>

      {user ? (
        <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px', textAlign: 'center' }}>
          <p>{user.email}님, 환영합니다.</p>
          <Button onClick={() => navigate('/seller/dashboard')} style={{ width: '100%', padding: '10px', marginTop: '10px' }}>대시보드로 이동</Button>
          <Button onClick={handleLogout} style={{ width: '100%', padding: '10px', marginTop: '10px' }} variant="secondary">로그아웃</Button>
        </div>
      ) : (
        <>
          <div style={{ border: '1px solid #ccc', padding: '20px', marginBottom: '20px' }}>
            <h2>로그인</h2>
            <input value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="ID" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="비밀번호" style={{ width: '100%', padding: '8px', marginBottom: '10px' }} />
            <Button onClick={handleLogin} style={{ width: '100%', padding: '10px', marginBottom: '10px' }}>로그인</Button>
            <Button onClick={() => navigate('/seller-signup')} style={{ width: '100%', padding: '10px' }}>회원가입</Button>
          </div>
        </>
      )}
    </div>
  );
}