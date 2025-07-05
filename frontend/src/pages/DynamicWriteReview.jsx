// src/pages/DynamicWriteReview.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { auth, onAuthStateChanged, db, getStorageInstance, ref, uploadBytes, getDownloadURL, addDoc, collection, serverTimestamp, getDoc, doc } from '../firebaseConfig';
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
  const [authChecked, setAuthChecked] = useState(false);

  const [form, setForm] = useState({
    name: '', phoneNumber: '', participantId: '', orderNumber: '', address: '',
    bank: '', bankNumber: '', accountHolderName: '', rewardAmount: '',
    productName: '',
  });
  const [images, setImages] = useState({});
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMainAccountId, setSelectedMainAccountId] = useState(null);
  const [selectedSubAccountId, setSelectedSubAccountId] = useState(null);
  const [isAccountSelected, setIsAccountSelected] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!linkId) {
      setError('유효하지 않은 링크 ID입니다.');
      setLoading(false);
      return;
    }
    const fetchLinkData = async () => {
      setLoading(true);
      const docRef = doc(db, 'links', linkId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLinkData(data);
        setForm(prev => ({ ...prev, productName: data.title }));
      } else {
        setError('해당 링크를 찾을 수 없습니다.');
      }
      setLoading(false);
    };
    fetchLinkData();
  }, [linkId]);

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
    setSelectedMainAccountId(uid);
    setSelectedSubAccountId(subAccount.id);
    setIsAccountSelected(true);
    setIsModalOpen(false);
  };

  const onFile = (e) => {
    const { name, files } = e.target;
    if (!files[0]) return;
    setImages({ ...images, [name]: files[0] });
    setPreview({ ...preview, [name]: URL.createObjectURL(files[0]) });
  };
  
  const uploadOne = async (file) => {
    try {
      const r = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      return await getDownloadURL(r);
    } catch (err) {
      console.warn('❌ 이미지 업로드 실패 (무시):', err.message);
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMainAccountId) {
      alert('먼저 회원 정보를 선택해주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        const url = await uploadOne(file);
        if (url) urlMap[key + 'Url'] = url;
      }
      
      await addDoc(collection(db, 'reviews'), {
        ...form,
        ...urlMap,
        linkId: linkId,
        mainAccountId: selectedMainAccountId,
        subAccountId: selectedSubAccountId,
        createdAt: serverTimestamp(),
        status: 'submitted',
      });

      alert('리뷰가 성공적으로 제출되었습니다.');
      navigate('/my-reviews', { replace: true });
    } catch (err) {
      alert('제출 실패: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    if (currentUser) {
      setIsModalOpen(true);
    } else {
      alert('리뷰를 작성하려면 먼저 로그인이 필요합니다.');
      navigate('/reviewer-login');
    }
  }

  if (!authChecked || loading) return <p style={{textAlign: 'center', padding: '50px'}}>페이지 정보를 불러오는 중...</p>;
  if (error) return <p style={{textAlign: 'center', padding: '50px', color: 'red'}}>{error}</p>;

  return (
    <div className="page-wrap">
      <h2 className="title">{linkData?.title || '리뷰 작성'}</h2>
      {linkData?.content && (<div className="notice-box">{linkData.content}</div>)}
      <div className="account-actions" style={{marginBottom: '20px', display: 'flex', gap: '10px'}}>
        <button type="button" onClick={() => setIsModalOpen(true)} className="submit-btn" style={{flex: 1}}>
          회원 정보 입력/선택
        </button>
      </div>

      {isModalOpen && (<AccountModal onClose={() => setIsModalOpen(false)} onSelectAccount={handleSelectAccount}/>)}
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