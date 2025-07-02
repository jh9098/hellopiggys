// src/pages/DynamicWriteReview.jsx

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, getStorageInstance, ref, uploadBytes, getDownloadURL, addDoc, collection, serverTimestamp, getDoc, doc } from '../firebaseConfig';
import '../pages/WriteReview.css'; // 기존 CSS 재사용

export default function DynamicWriteReview() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const storage = getStorageInstance();

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
    title: '',
    content: '',
  });
  const [images, setImages] = useState({});
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);

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
        // Firestore에서 가져온 제목으로 폼 상태 초기화
        setForm(prev => ({ ...prev, title: data.title }));
      } else {
        setError('해당 링크를 찾을 수 없습니다.');
      }
      setLoading(false);
    };
    fetchLinkData();
  }, [linkId]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
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
    setSubmitting(true);
    try {
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        const url = await uploadOne(file);
        if (url) urlMap[key + 'Url'] = url;
      }
      // 리뷰 문서 저장 시 linkId 포함
      await addDoc(collection(db, 'reviews'), {
        ...form,
        ...urlMap,
        linkId: linkId, // 어떤 링크를 통해 들어왔는지 기록
        createdAt: serverTimestamp(),
      });
      localStorage.setItem('REVIEWER_NAME', form.name.trim());
      localStorage.setItem('REVIEWER_PHONE', form.phoneNumber.trim());
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
      {/* 제목을 Firestore에서 가져온 데이터로 동적 표시 */}
      <h2 className="title">{linkData?.title || '리뷰 작성'}</h2>

      {/* 내용(공지)을 Firestore에서 가져온 데이터로 동적 표시 */}
      {linkData?.content && (
          <div className="notice-box">{linkData.content}</div>
      )}

      {/* 폼 부분은 기존 WriteReview.jsx와 대부분 동일 */}
      <form onSubmit={handleSubmit}>
        {/* 기본 정보 */}
        {[
          { key: 'name', label: '구매자(수취인)', ph: '이름을 입력하세요.' },
          { key: 'phoneNumber', label: '전화번호', ph: '숫자만 입력하세요.', type: 'tel' },
          { key: 'participantId', label: '참가자ID', ph: '' },
          { key: 'orderNumber', label: '주문번호', ph: '' },
          { key: 'address', label: '주소', ph: '도로명 주소' },
          { key: 'detailAddress', label: '상세주소', ph: '' },
        ].map(({ key, label, ph, type }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              name={key}
              value={form[key]}
              onChange={onChange}
              placeholder={ph}
              type={type || 'text'}
              required={key !== 'detailAddress'}
            />
          </div>
        ))}

        {/* 입금 정보 */}
        <div className="field">
          <label>은행</label>
          <select name="bank" value={form.bank} onChange={onChange} required>
            <option value="">은행 선택</option>
            {['국민', '농협', '신한', '우리', '하나', '카카오뱅크'].map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        {[
          { key: 'bankNumber', label: '계좌번호' },
          { key: 'accountHolderName', label: '예금주' },
          { key: 'rewardAmount', label: '금액' },
        ].map(({ key, label }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              name={key}
              value={form[key]}
              onChange={onChange}
              required={key !== 'rewardAmount'}
            />
          </div>
        ))}

        {/* 이미지 업로드 */}
        {[
          { key: 'likeImage', label: '상품 찜 캡처 (필수)', req: true },
          { key: 'orderImage', label: '구매 인증 캡처 (최대 2개)', req: true },
          { key: 'secondOrderImage', label: '추가 구매 인증 (선택)', req: false },
        ].map(({ key, label, req }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              type="file"
              accept="image/*"
              name={key}
              onChange={onFile}
              required={req}
            />
              {preview[key] && (
                <img className="thumb" src={preview[key]} alt={key} />
              )}
          </div>
        ))}

        {/* 약관 */}
        <div className="field">
          <label>
            <input type="checkbox" required /> 약관을 확인하였어요
          </label>
        </div>

        <button className="submit-btn" disabled={submitting}>
          {submitting ? '제출 중…' : '제출하기'}
        </button>
      </form>    </div>
  );
}