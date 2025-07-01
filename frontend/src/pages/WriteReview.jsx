import { useState } from 'react';
import axios from 'axios';

// .env에서 API베이스 URL 지정 (예: http://localhost:5000)
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function WriteReview() {
  /* ---------------------- 1. 상태 ---------------------- */
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

  const [images, setImages] = useState({
    likeImage: null,
    orderImage: null,
    secondOrderImage: null,
    reviewImage: null,
  });
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  /* ---------------------- 2. 핸들러 ---------------------- */
  const onChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const onFileChange = (e) => {
    const { name, files } = e.target; // name === key(likeImage 등)
    if (!files[0]) return;
    setImages({ ...images, [name]: files[0] });
    setPreview({
      ...preview,
      [name]: URL.createObjectURL(files[0]),
    });
  };

  /* S3·Firebase Storage 업로드처럼: 파일  →  /api/upload → {url} */
  const uploadImage = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await axios.post(`${API_BASE}/api/upload`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url; // 서버에서 받은 다운로드 URL
  };

  /* ---------------------- 3. 제출 ---------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      /* 3-1) 이미지부터 올려서 URL 받기 */
      const uploadedUrls = {};
      for (const [key, file] of Object.entries(images)) {
        if (file) uploadedUrls[key] = await uploadImage(file);
      }

      /* 3-2) 리뷰/구매 정보 함께 전송 */
      const payload = {
        ...form,
        ...uploadedUrls, // likeImage, orderImage ... => 업로드된 URL
      };
      await axios.post(`${API_BASE}/api/reviews`, payload);
      setMessage('🎉 리뷰가 성공적으로 등록되었습니다!');
      // 초기화
      setForm({
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
      setImages({});
      setPreview({});
    } catch (err) {
      console.error(err);
      setMessage('❌ 오류: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------- 4. UI ---------------------- */
  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
      <h2>구매 정보 + 리뷰 작성</h2>
      <form onSubmit={handleSubmit}>
        {/* 구매자 기본 정보 */}
        <fieldset>
          <legend>구매자 정보</legend>
          <label>
            이름&nbsp;
            <input name="name" value={form.name} onChange={onChange} required />
          </label>
          <br />
          <label>
            휴대폰&nbsp;
            <input
              name="phoneNumber"
              value={form.phoneNumber}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            참가자 ID&nbsp;
            <input
              name="participantId"
              value={form.participantId}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            주문번호&nbsp;
            <input
              name="orderNumber"
              value={form.orderNumber}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            주소&nbsp;
            <input
              name="address"
              value={form.address}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            상세주소&nbsp;
            <input
              name="detailAddress"
              value={form.detailAddress}
              onChange={onChange}
            />
          </label>
        </fieldset>

        {/* 리워드 입금 정보 */}
        <fieldset style={{ marginTop: '16px' }}>
          <legend>리워드 입금정보</legend>
          <label>
            은행명&nbsp;
            <input
              name="bank"
              value={form.bank}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            계좌번호&nbsp;
            <input
              name="bankNumber"
              value={form.bankNumber}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            예금주&nbsp;
            <input
              name="accountHolderName"
              value={form.accountHolderName}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            리워드 금액(원)&nbsp;
            <input
              name="rewardAmount"
              value={form.rewardAmount}
              onChange={onChange}
            />
          </label>
        </fieldset>

        {/* 리뷰 본문 */}
        <fieldset style={{ marginTop: '16px' }}>
          <legend>리뷰 내용</legend>
          <label>
            리뷰 제목&nbsp;
            <input
              name="title"
              value={form.title}
              onChange={onChange}
              required
            />
          </label>
          <br />
          <label>
            리뷰 내용&nbsp;
            <textarea
              rows="5"
              cols="50"
              name="content"
              value={form.content}
              onChange={onChange}
              required
            />
          </label>
        </fieldset>

        {/* 이미지 업로드 */}
        <fieldset style={{ marginTop: '16px' }}>
          <legend>이미지 업로드</legend>

          <label>
            상품 찜 캡처&nbsp;
            <input
              type="file"
              accept="image/*"
              name="likeImage"
              onChange={onFileChange}
              required
            />
          </label>
          {preview.likeImage && (
            <img
              src={preview.likeImage}
              alt="likeImage"
              width="120"
              style={{ display: 'block', marginTop: 4 }}
            />
          )}

          <label>
            구매 내역 캡처&nbsp;
            <input
              type="file"
              accept="image/*"
              name="orderImage"
              onChange={onFileChange}
              required
            />
          </label>
          {preview.orderImage && (
            <img
              src={preview.orderImage}
              alt="orderImage"
              width="120"
              style={{ display: 'block', marginTop: 4 }}
            />
          )}

          <label>
            추가 구매 내역(선택)&nbsp;
            <input
              type="file"
              accept="image/*"
              name="secondOrderImage"
              onChange={onFileChange}
            />
          </label>
          {preview.secondOrderImage && (
            <img
              src={preview.secondOrderImage}
              alt="secondOrderImage"
              width="120"
              style={{ display: 'block', marginTop: 4 }}
            />
          )}

          <label>
            리뷰 인증 캡처&nbsp;
            <input
              type="file"
              accept="image/*"
              name="reviewImage"
              onChange={onFileChange}
              required
            />
          </label>
          {preview.reviewImage && (
            <img
              src={preview.reviewImage}
              alt="reviewImage"
              width="120"
              style={{ display: 'block', marginTop: 4 }}
            />
          )}
        </fieldset>

        <button
          type="submit"
          style={{ marginTop: '20px' }}
          disabled={submitting}
        >
          {submitting ? '제출 중…' : '리뷰 제출'}
        </button>
      </form>

      {message && (
        <p style={{ marginTop: '12px', fontWeight: 'bold' }}>{message}</p>
      )}
    </div>
  );
}
