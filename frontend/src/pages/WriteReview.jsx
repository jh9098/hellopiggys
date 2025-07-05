import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  getStorageInstance,
  ref,
  uploadBytes,
  getDownloadURL,
  addDoc,
  collection,
  serverTimestamp,
} from '../firebaseConfig';
import './WriteReview.css';

export default function WriteReview() {
  const navigate = useNavigate();
  const storage  = getStorageInstance();      // 필요 시만 초기화

  /* ───────────────────────── state ───────────────────────── */
  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    participantId: '',
    orderNumber: '',
    address: '',
    bank: '',
    bankNumber: '',
    accountHolderName: '',
    rewardAmount: '',
    title: '',
    content: '',
  });
  const [images, setImages]   = useState({});
  const [preview, setPreview] = useState({});
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ────────────────────── helpers ────────────────────── */
  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const onFile = (e) => {
    const { name, files } = e.target;
    if (!files[0]) return;
    setImages({ ...images, [name]: files[0] });
    setPreview({ ...preview, [name]: URL.createObjectURL(files[0]) });
  };

  // ⬇️ 실패하면 null 반환 — Firestore에 넣지 않음
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

  /* ───────────────────── submit ───────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      /* 이미지 업로드 */
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        const url = await uploadOne(file);
        if (url) urlMap[key + 'Url'] = url; // 성공한 것만 저장
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
      setMsg('❌ 제출 실패: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ───────────────────── JSX ───────────────────── */
  return (
    <div className="page-wrap">
      <h2 className="title">🟢환영🟢별리⭐</h2>

      <form onSubmit={handleSubmit}>
        {/* 기본 정보 */}
        {[
          { key: 'name', label: '구매자(수취인)', ph: '이름을 입력하세요.' },
          { key: 'phoneNumber', label: '전화번호', ph: '숫자만 입력하세요.', type: 'tel' },
          { key: 'participantId', label: '참가자ID', ph: '' },
          { key: 'orderNumber', label: '주문번호', ph: '' },
          { key: 'address', label: '주소', ph: '도로명 주소' },
        ].map(({ key, label, ph, type }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              name={key}
              value={form[key]}
              onChange={onChange}
              placeholder={ph}
              type={type || 'text'}
            />
          </div>
        ))}

        {/* 입금 정보 */}
        <div className="field">
          <label>은행</label>
          <select name="bank" value={form.bank} onChange={onChange} required>
            <option value="">은행 선택</option>
            {[  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
].map((b) => (
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
          { key: 'likeImage', label: '상품 찜 캡처 (필수)', req: false },
          { key: 'orderImage', label: '구매 인증 캡처 (최대 2개)', req: false },
          { key: 'secondOrderImage', label: '추가 구매 인증 (선택)', req: false },
          { key: 'reviewImage', label: '리뷰 인증 캡처 (필수)', req: false },
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
            <input type="checkbox" required /> 개인정보 이용에 동의합니다
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
