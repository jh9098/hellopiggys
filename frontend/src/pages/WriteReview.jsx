import { useState } from 'react';
import axios from 'axios';
import './WriteReview.css';        // ❗ 아래 CSS 함께 생성

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function WriteReview() {
  /* ---------- 상태 ---------- */
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
  });
  const [images, setImages] = useState({
    likeImage: null,
    orderImage: null,
    secondOrderImage: null,
    reviewImage: null,
  });
  const [preview, setPreview] = useState({});
  const [msg, setMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /* ---------- 헬퍼 ---------- */
  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const onFile = (e) => {
    const { name, files } = e.target;
    if (!files[0]) return;
    setImages({ ...images, [name]: files[0] });
    setPreview({ ...preview, [name]: URL.createObjectURL(files[0]) });
  };

  const uploadOne = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await axios.post(`${API}/api/upload`, fd);
    return res.data.url;
  };

  /* ---------- 제출 ---------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const urlMap = {};
      for (const [k, f] of Object.entries(images)) {
        if (f) urlMap[k + 'Url'] = await uploadOne(f);
      }
      await axios.post(`${API}/api/reviews`, { ...form, ...urlMap });
      setMsg('🎉 리뷰가 등록되었습니다!');
      // 초기화
      setForm({ ...Object.fromEntries(Object.keys(form).map(k => [k, ''])) });
      setImages({});
      setPreview({});
    } catch (err) {
      console.error(err);
      setMsg('❌ 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- 렌더 ---------- */
  return (
    <div className="page-wrap">
      {/* 상단 안내 (관리자 입력 영역) */}
      <section className="notice-box">
        {/* 👉 관리자 설정용 영역 – 필요 시 Firestore로부터 불러와 렌더링 */}
      </section>

      <h2 className="title">🟢환영🟢별리⭐</h2>

      <form onSubmit={handleSubmit}>
        {/* ───────── 기본 정보 ───────── */}
        <div className="field">
          <label>구매자(수취인)</label>
          <input
            name="name"
            value={form.name}
            onChange={onChange}
            placeholder="이름을 입력하세요."
            required
          />
        </div>
        <div className="field">
          <label>전화번호</label>
          <input
            name="phoneNumber"
            value={form.phoneNumber}
            onChange={onChange}
            placeholder="숫자만 입력하세요."
            required
          />
        </div>
        <div className="field">
          <label>참가자ID</label>
          <input
            name="participantId"
            value={form.participantId}
            onChange={onChange}
            required
          />
        </div>
        <div className="field">
          <label>주문번호</label>
          <input
            name="orderNumber"
            value={form.orderNumber}
            onChange={onChange}
            required
          />
        </div>
        <div className="field">
          <label>주소</label>
          <input
            name="address"
            value={form.address}
            onChange={onChange}
            placeholder="도로명 주소"
            required
          />
        </div>
        <div className="field">
          <label>상세주소</label>
          <input
            name="detailAddress"
            value={form.detailAddress}
            onChange={onChange}
          />
        </div>

        {/* ───────── 입금 정보 ───────── */}
        <div className="field">
          <label>은행</label>
          <select name="bank" value={form.bank} onChange={onChange} required>
            <option value="">은행 선택</option>
            {['국민','농협','신한','우리','하나','카카오뱅크'].map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>계좌번호</label>
          <input
            name="bankNumber"
            value={form.bankNumber}
            onChange={onChange}
            required
          />
        </div>
        <div className="field">
          <label>예금주</label>
          <input
            name="accountHolderName"
            value={form.accountHolderName}
            onChange={onChange}
            required
          />
        </div>
        <div className="field">
          <label>금액</label>
          <input
            name="rewardAmount"
            value={form.rewardAmount}
            onChange={onChange}
          />
        </div>

        {/* ───────── 이미지 업로드 ───────── */}
        {[
          { key: 'likeImage', label: '상품 찜 캡처 (필수)' },
          { key: 'orderImage', label: '구매 인증 캡처 (최대 2개)' },
          { key: 'secondOrderImage', label: '추가 구매 인증 (선택)' },
          { key: 'reviewImage', label: '리뷰 인증 캡처 (필수)' },
        ].map(({ key, label }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <input
              type="file"
              accept="image/*"
              name={key}
              onChange={onFile}
              required={key === 'likeImage' || key === 'orderImage' || key === 'reviewImage'}
            />
            {preview[key] && (
              <img className="thumb" src={preview[key]} alt={key} />
            )}
          </div>
        ))}

        {/* ───────── 약관 ───────── */}
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
