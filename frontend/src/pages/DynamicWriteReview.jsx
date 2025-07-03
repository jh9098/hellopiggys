import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, getStorageInstance, ref, uploadBytes, getDownloadURL, addDoc, collection, serverTimestamp, getDoc, doc } from '../firebaseConfig';
import AccountModal from '../components/AccountModal'; // 모달 컴포넌트 import
import './WriteReview.css'; // 기존 CSS 재사용

export default function DynamicWriteReview() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const storage = getStorageInstance();

  // --- 상태 관리 ---
  const [linkData, setLinkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    participantId: '',
    orderNumber: '',
    address: '',
    detailAddress: '',
    bank: '',
    bankNumber: '',
    accountHolderName: '',
    rewardAmount: '',
    title: '', // 이 값은 linkData에서 채워짐
  });
  const [images, setImages] = useState({});
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // 계정 선택 관련 상태
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMainAccountId, setSelectedMainAccountId] = useState(null);
  const [selectedSubAccountId, setSelectedSubAccountId] = useState(null);

  // --- 데이터 로딩 ---
  useEffect(() => {
    if (!linkId) {
      setError('유효하지 않은 링크 ID입니다.');
      setLoading(false);
      return;
    }
    const fetchLinkData = async () => {
      const docRef = doc(db, 'links', linkId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLinkData(data);
        setForm(prev => ({ ...prev, title: data.title }));
      } else {
        setError('해당 링크를 찾을 수 없습니다.');
      }
      setLoading(false);
    };
    fetchLinkData();
  }, [linkId]);

  // --- 핸들러 ---
  const handleSelectAccount = (subAccount, mainAccountId) => {
    setForm(prev => ({
      ...prev,
      name: subAccount.name || '',
      phoneNumber: subAccount.phoneNumber || '',
      address: subAccount.address || '',
      detailAddress: subAccount.detailAddress || '',
      bank: subAccount.bank || '',
      bankNumber: subAccount.bankNumber || '',
      accountHolderName: subAccount.accountHolderName || '',
    }));
    setSelectedMainAccountId(mainAccountId);
    setSelectedSubAccountId(subAccount.id);
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
      alert('먼저 회원 정보를 입력 또는 선택해주세요.');
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

      // localStorage에는 본계정 정보만 저장
      const mainAccountInfo = selectedMainAccountId.split('_');
      localStorage.setItem('REVIEWER_NAME', mainAccountInfo[0]);
      localStorage.setItem('REVIEWER_PHONE', mainAccountInfo[1]);

      navigate('/reviewer-login', { replace: true });
    } catch (err) {
      alert('제출 실패: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{textAlign: 'center', padding: '50px'}}>페이지 정보를 불러오는 중...</p>;
  if (error) return <p style={{textAlign: 'center', padding: '50px', color: 'red'}}>{error}</p>;

  return (
    <div className="page-wrap">
      <h2 className="title">{linkData?.title || '리뷰 작성'}</h2>

      {linkData?.content && (
          <div className="notice-box">{linkData.content}</div>
      )}

      <div className="account-actions" style={{marginBottom: '20px', display: 'flex', gap: '10px'}}>
        <button type="button" onClick={() => setIsModalOpen(true)} className="submit-btn" style={{flex: 1}}>
          회원 정보 입력/선택
        </button>
      </div>

      {isModalOpen && (
        <AccountModal 
          onClose={() => setIsModalOpen(false)}
          onSelectAccount={handleSelectAccount}
        />
      )}

      <form onSubmit={handleSubmit}>
        {/* 기본 정보 (읽기 전용) */}
        {[
          { key: 'name', label: '구매자(수취인)' },
          { key: 'phoneNumber', label: '전화번호' },
          { key: 'address', label: '주소' },
          { key: 'detailAddress', label: '상세주소' },
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
          { key: 'participantId', label: '참가자ID', ph: '참가자ID를 입력하세요' },
          { key: 'orderNumber', label: '주문번호', ph: '주문번호를 입력하세요' },
          { key: 'rewardAmount', label: '금액', ph: '지급받을 금액을 입력하세요' },
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
          { key: 'secondOrderImage', label: '추가 구매 인증 (선택)', req: false },
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
            <input type="checkbox" required /> 약관을 확인하였어요
          </label>
        </div>

        <button className="submit-btn" type="submit" disabled={submitting}>
          {submitting ? '제출 중…' : '제출하기'}
        </button>
      </form>
    </div>
  );
}