// src/pages/DynamicWriteReview.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, onAuthStateChanged, db, getStorageInstance, ref, uploadBytes, getDownloadURL, addDoc, collection, serverTimestamp, getDoc, doc } from '../firebaseConfig';
import LoginModal from '../components/LoginModal'; // 로그인/회원가입 모달
import AccountModal from '../components/AccountModal'; // 서브 계정 관리 모달

import './WriteReview.css';

export default function DynamicWriteReview() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const storage = getStorageInstance();

  // --- 상태 관리 ---
  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. 인증 및 모달 관련 상태
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  
  // 2. 리뷰 폼 관련 상태
  const [form, setForm] = useState({
    name: '', phoneNumber: '', participantId: '', orderNumber: '', address: '',
    bank: '', bankNumber: '', accountHolderName: '', rewardAmount: '',
    productName: '',
  });
  const [images, setImages] = useState({});
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isAccountSelected, setIsAccountSelected] = useState(false);

  // --- 데이터 로딩 및 인증 상태 감지 ---
  useEffect(() => {
    // Firebase 인증 상태를 실시간으로 감지
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

    // 링크 데이터 불러오기
    const fetchLinkData = async () => {
      if (!linkId) {
        setError('유효하지 않은 링크 ID입니다.');
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'links', linkId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLinkData(data);
          setForm(prev => ({ ...prev, productName: data.title }));
        } else {
          setError('해당 링크를 찾을 수 없습니다.');
        }
      } catch (e) {
        setError('링크 정보를 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchLinkData();
    return () => unsubscribe(); // 컴포넌트 언마운트 시 인증 리스너 정리
  }, [linkId]);


  // --- 핸들러 함수들 ---

  // 1. 메인 버튼 클릭 핸들러 (로그인/로그아웃/서브계정)
  const handleMainButtonClick = () => {
    if (currentUser) {
      setIsAccountModalOpen(true);
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  const handleLoginSuccess = (user) => {
    setIsLoginModalOpen(false);
    // 로그인에 성공했으므로, 바로 이어서 서브 계정 모달을 열어줍니다.
    setIsAccountModalOpen(true);
  };

  const handleSelectAccount = (subAccount, uid) => {
    setForm(prev => ({
      ...prev,
      name: subAccount.name || '',
      phoneNumber: subAccount.phoneNumber || '',
      address: subAccount.address || '',
      bank: subAccount.bank || '',
      bankNumber: subAccount.bankNumber || '',
      accountHolderName: subAccount.accountHolderName || '',
    }));
    setIsAccountSelected(true);
    setIsAccountModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('로그인 정보가 유효하지 않습니다.');
    setSubmitting(true);
    try {
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        const r = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        urlMap[key + 'Url'] = await getDownloadURL(r);
      }
      
      await addDoc(collection(db, 'reviews'), {
        ...form,
        linkId: linkId,
        mainAccountId: currentUser.uid,
        createdAt: serverTimestamp(),
        status: 'submitted',
        ...urlMap // <--- 이 부분이 추가되었습니다.
      });
      alert('리뷰가 성공적으로 제출되었습니다.');
      navigate('/my-reviews', { replace: true });
    } catch (err) {
      alert('제출 실패: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  const onFile = (e) => {
    const { name, files } = e.target;
    if (!files[0]) return;
    setImages({ ...images, [name]: files[0] });
    setPreview({ ...preview, [name]: URL.createObjectURL(files[0]) });
  };

  if (loading) return <p style={{textAlign: 'center', padding: '50px'}}>페이지 정보를 불러오는 중...</p>;
  if (error) return <p style={{textAlign: 'center', padding: '50px', color: 'red'}}>{error}</p>;

  return (
    <div className="page-wrap">
      <h2 className="title">{linkData?.title || '리뷰 작성'}</h2>
      {linkData?.content && (<div className="notice-box">{linkData.content}</div>)}
      
      <div className="account-actions">
        {currentUser ? (
          <>
            <button type="button" onClick={handleMainButtonClick}>서브 계정 선택/관리</button>
            <button type="button" onClick={handleLogout} className="logout-btn">로그아웃</button>
          </>
        ) : (
          <button type="button" onClick={handleMainButtonClick}>회원 정보 입력/선택</button>
        )}
      </div>

      {isLoginModalOpen && (
        <LoginModal 
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {isAccountModalOpen && (
        <AccountModal 
          onClose={() => setIsAccountModalOpen(false)} 
          onSelectAccount={handleSelectAccount}
        />
      )}
      {isAccountSelected && (
        <form onSubmit={handleSubmit}>
          {/* 기본 정보 (읽기 전용) */}
          {[
            { key: 'name', label: '구매자(수취인)' },
            { key: 'phoneNumber', label: '전화번호' },
            { key: 'address', label: '주소' },
          ].map(({ key, label }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input name={key} value={form[key]} readOnly style={{background: '#f0f0f0', cursor: 'not-allowed'}}/>
            </div>
          ))}

          {/* 입금 정보 (읽기 전용) */}
          <div className="field">
            <label>은행</label>
            <input name="bank" value={form.bank} readOnly style={{background: '#f0f0f0', cursor: 'not-allowed'}}/>
          </div>
          {[
            { key: 'bankNumber', label: '계좌번호' },
            { key: 'accountHolderName', label: '예금주' },
          ].map(({ key, label }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input name={key} value={form[key]} readOnly style={{background: '#f0f0f0', cursor: 'not-allowed'}}/>
            </div>
          ))}
          
          {/* 사용자가 직접 입력해야 하는 필드 */}
          {[
            { key: 'participantId', label: '상품명', ph: '상품명을 그대로 복사하세요' },
            { key: 'orderNumber', label: '주문번호', ph: '주문번호를 그대로 복사하세요' },
            { key: 'rewardAmount', label: '금액', ph: '결제금액을 입력하세요' },
          ].map(({ key, label, ph }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input
                name={key}
                value={form[key]}
                onChange={(e) => setForm({...form, [e.target.name]: e.target.value})}
                placeholder={ph}
                required
              />
            </div>
          ))}

          {/* 이미지 업로드 */}
          {[
            { key: 'likeImage', label: '상품 찜 캡처 (필수)', req: false },
            { key: 'orderImage', label: '구매 인증 캡처 (필수)', req: false },
            { key: 'cashcardImage', label: '현영/매출전표(필수)', req: false },
            { key: 'keywordImage', label: '키워드 인증(필수)', req: false },
          ].map(({ key, label, req }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input type="file" accept="image/*" name={key} onChange={onFile} required={req} />
              {preview[key] && (<img className="thumb" src={preview[key]} alt={key} />)}
            </div>
          ))}

          {/* 약관 */}
          <div className="field">
            <label>
              <input type="checkbox" required /> 개인정보 이용에 동의합니다.
            </label>
          </div>

          <button className="submit-btn" type="submit" disabled={submitting}>
            {submitting ? '제출 중…' : '제출하기'}
          </button>
        </form>
      )}
    </div>
  );
}