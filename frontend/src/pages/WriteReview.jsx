import { useState } from 'react';
import { useNavigate } from 'react-router-dom';   // React-Router 훅
import {
  getStorageInstance,
  db,
  ref,
  uploadBytes,
  getDownloadURL,
  addDoc,
  collection,
  serverTimestamp,
} from '../firebaseConfig';
import './WriteReview.css';

export default function WriteReview() {
  const navigate = useNavigate();                // SPA 내비게이터
  const storage   = getStorageInstance();            // ✅ 한 번만 확보

  /* ───────────────────────── state ───────────────────────── */
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
  const [images] = useState({});
  const [previews, setPreviews] = useState({});
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ────────────────────── helpers ────────────────────── */
  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const onFile = (e) => {
    const { name, files } = e.target;
    if (!files[0]) return;
    images[name] = files[0];
    setPreviews({ ...previews, [name]: URL.createObjectURL(files[0]) });
  };

  const uploadOne = async (file) => {
    const r = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
  };

  /* ───────────────────── submit ───────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      /* 이미지 업로드 */
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        if (file) urlMap[key + 'Url'] = await uploadOne(file);
      }

      /* 리뷰 문서 저장 */
      await addDoc(collection(db, 'reviews'), {
        ...form,
        ...urlMap,
        createdAt: serverTimestamp(),
      });

      /* 이름·전화 localStorage 저장 */
      localStorage.setItem('REVIEWER_NAME', form.name.trim());
      localStorage.setItem('REVIEWER_PHONE', form.phoneNumber.trim());

      /* 로그인 화면으로 이동 (SPA 라우팅) */
      navigate('/reviewer-login', { replace: true });

    } catch (err) {
      console.error(err);
      setMsg('❌ 오류: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ───────────────────── JSX ───────────────────── */
  return (
    <div className="page-wrap">
      <h2 className="title">현영/별리⭐</h2>

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
          { key: 'reviewImage', label: '리뷰 인증 캡처 (필수)', req: true },
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
              {previews[key] && (
                <img className="thumb" src={previews[key]} alt={key} />
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
        {msg && <p className="msg">{msg}</p>}
      </form>
    </div>
  );
}
