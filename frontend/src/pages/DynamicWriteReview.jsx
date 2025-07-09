// src/pages/DynamicWriteReview.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, onAuthStateChanged, db, getStorageInstance, ref, uploadBytes, getDownloadURL, addDoc, collection, serverTimestamp, getDoc, doc } from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import AccountModal from '../components/AccountModal';

import './WriteReview.css';

export default function DynamicWriteReview() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const storage = getStorageInstance();

  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  
  const [form, setForm] = useState({
    name: '', phoneNumber: '', participantId: '', orderNumber: '', address: '',
    bank: '', bankNumber: '', accountHolderName: '', rewardAmount: '',
    productName: '',
    subAccountId: null, // subAccountId를 저장할 필드 추가
  });
  const [images, setImages] = useState({});
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isAccountSelected, setIsAccountSelected] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });

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
          setForm(prev => ({ ...prev, productName: data.title, title: data.title })); // 'title'도 form에 저장
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
    return () => unsubscribe();
  }, [linkId]);

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
    setIsAccountModalOpen(true);
  };

  // ▼▼▼ 핵심 수정 부분 1 ▼▼▼
  const handleSelectAccount = (subAccount) => {
    setForm(prev => ({
      ...prev,
      // subAccount 객체에서 받은 정보를 form 상태에 매핑
      name: subAccount.name || '',
      phoneNumber: subAccount.phoneNumber || '',
      address: subAccount.address || '',
      bank: subAccount.bank || '',
      bankNumber: subAccount.bankNumber || '',
      accountHolderName: subAccount.accountHolderName || '',
      subAccountId: subAccount.id, // 선택된 서브 계정의 ID를 저장합니다.
    }));
    setIsAccountSelected(true);
    setIsAccountModalOpen(false);
  };
  // ▲▲▲ 핵심 수정 부분 1 ▲▲▲

  // ▼▼▼ 핵심 수정 부분 2 ▼▼▼
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('로그인 정보가 유효하지 않습니다.');
    if (!form.subAccountId) return alert('계정 정보가 올바르지 않습니다. 계정을 다시 선택해주세요.');

    setSubmitting(true);
    try {
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        const r = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        urlMap[key + 'Url'] = await getDownloadURL(r);
      }
      
      // 저장할 데이터 객체를 만듭니다.
      const reviewData = {
        mainAccountId: currentUser.uid,
        subAccountId: form.subAccountId, // form에 저장된 subAccountId를 포함시킵니다.
        linkId: linkId,
        createdAt: serverTimestamp(),
        status: 'submitted',
        title: form.productName, // 상품 제목
        participantId: form.participantId, // 상품명 (사용자 입력)
        orderNumber: form.orderNumber,
        rewardAmount: form.rewardAmount,
        ...urlMap, // 이미지 URL 맵
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      
      alert('리뷰가 성공적으로 제출되었습니다.');
      navigate('/my-reviews', { replace: true });
    } catch (err) {
      alert('제출 실패: ' + err.message);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };
  // ▲▲▲ 핵심 수정 부분 2 ▲▲▲
  
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
          {/* 읽기 전용 필드들 */}
          {[
            { key: 'name', label: '구매자(수취인)' }, { key: 'phoneNumber', label: '전화번호' },
            { key: 'address', label: '주소' }, { key: 'bank', label: '은행' },
            { key: 'bankNumber', label: '계좌번호' }, { key: 'accountHolderName', label: '예금주' },
          ].map(({ key, label }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input value={form[key]} readOnly style={{background: '#f0f0f0', cursor: 'not-allowed'}}/>
            </div>
          ))}
          
          {/* 사용자가 직접 입력하는 필드 */}
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
            { key: 'likeImage', label: '상품 찜 캡처 (필수)', req: true },
            { key: 'orderImage', label: '구매 인증 캡처 (필수)', req: true },
            { key: 'cashcardImage', label: '현영/매출전표(필수)', req: true },
            { key: 'keywordImage', label: '키워드 인증(필수)', req: true },
          ].map(({ key, label, req }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input type="file" accept="image/*" name={key} onChange={onFile} required={req} />
              {preview[key] && (<img className="thumb" src={preview[key]} alt={key} />)}
            </div>
          ))}

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