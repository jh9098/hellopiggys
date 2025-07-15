// src/components/ReviewDetailModal.jsx (오류 수정 최종본)

import React, { useState, useEffect } from 'react';
import { db, doc, updateDoc } from '../firebaseConfig';
import './ReviewDetailModal.css';

// 모달에 표시할 이미지 목록 정의
// ▼▼▼ 이 상수를 수정합니다 ▼▼▼
const initialImageFields = [
  // 'keywordAndLikeImageUrls' -> 'keywordAndLikeImagesUrls' 로 수정
  { key: 'keywordAndLikeImagesUrls', label: '키워드 & 찜 인증' },
  { key: 'orderImageUrls', label: '구매 인증' },
  { key: 'cashcardImageUrls', label: '현영/매출전표' },
];
// ▲▲▲

const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리',
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협',
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

export default function ReviewDetailModal({ review, onClose }) {
  if (!review) return null;

  const [isEditing, setIsEditing] = useState(false);
  const [currentReview, setCurrentReview] = useState(review);
  const [editableData, setEditableData] = useState({});
  const [imagePreview, setImagePreview] = useState(null);

  const openImagePreview = (url) => setImagePreview(url);
  const closeImagePreview = () => setImagePreview(null);

  useEffect(() => {
    setCurrentReview(review);
    setEditableData({
      name: review.name || '',
      phoneNumber: review.phoneNumber || '',
      address: review.address || '',
      participantId: review.participantId || '',
      orderNumber: review.orderNumber || '',
      rewardAmount: review.rewardAmount || '',
      bank: review.bank || '',
      bankNumber: review.bankNumber || '',
      accountHolderName: review.accountHolderName || ''
    });
  }, [review]);

  const handleDataChange = (e) => {
    const { name, value } = e.target;
    if (['phoneNumber', 'bankNumber', 'orderNumber', 'rewardAmount'].includes(name)) {
      setEditableData(prev => ({ ...prev, [name]: value.replace(/[^0-9]/g, '') }));
    } else {
      setEditableData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    try {
      if (currentReview.subAccountId) {
        await updateDoc(doc(db, 'subAccounts', currentReview.subAccountId), {
          name: editableData.name,
          phoneNumber: editableData.phoneNumber,
          address: editableData.address,
          bank: editableData.bank,
          bankNumber: editableData.bankNumber,
          accountHolderName: editableData.accountHolderName
        });
      }
      await updateDoc(doc(db, 'reviews', currentReview.id), {
        participantId: editableData.participantId,
        orderNumber: editableData.orderNumber,
        rewardAmount: editableData.rewardAmount
      });
      setCurrentReview(prev => ({ ...prev, ...editableData }));
      alert('수정이 완료되었습니다.');
      setIsEditing(false);
    } catch (err) {
      alert('수정 실패: ' + err.message);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditableData({
      name: currentReview.name || '',
      phoneNumber: currentReview.phoneNumber || '',
      address: currentReview.address || '',
      participantId: currentReview.participantId || '',
      orderNumber: currentReview.orderNumber || '',
      rewardAmount: currentReview.rewardAmount || '',
      bank: currentReview.bank || '',
      bankNumber: currentReview.bankNumber || '',
      accountHolderName: currentReview.accountHolderName || ''
    });
  };

  return (
    <>
    <div className="modal-back" onClick={onClose}>
      <div className="review-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✖</button>
        {!isEditing ? (
          <button className="edit-btn" onClick={() => setIsEditing(true)}>수정</button>
        ) : (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSave}>저장</button>
            <button className="cancel-btn" onClick={handleCancel}>취소</button>
          </div>
        )}
        <h3>리뷰 제출 내용 상세</h3>
        
          <div className="modal-section">
            <h4>기본 정보</h4>
            <div className="info-grid">
              <div>
                <label>구매자(수취인)</label>
                {isEditing ? (
                  <input name="name" value={editableData.name} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.name || '-'}</p>
                )}
              </div>
              <div>
                <label>전화번호</label>
                {isEditing ? (
                  <input name="phoneNumber" value={editableData.phoneNumber} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.phoneNumber || '-'}</p>
                )}
              </div>
              <div>
                <label>주소</label>
                {isEditing ? (
                  <input name="address" value={editableData.address} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.address || '-'}</p>
                )}
              </div>
              <div>
                <label>쿠팡 ID</label>
                {isEditing ? (
                  <input name="participantId" value={editableData.participantId} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.participantId || '-'}</p>
                )}
              </div>
              <div>
                <label>주문번호</label>
                {isEditing ? (
                  <input name="orderNumber" value={editableData.orderNumber} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.orderNumber || '-'}</p>
                )}
              </div>
              <div>
                <label>금액</label>
                {isEditing ? (
                  <input name="rewardAmount" value={editableData.rewardAmount} onChange={handleDataChange} />
                ) : (
                  <p>{Number(currentReview.rewardAmount || 0).toLocaleString()}원</p>
                )}
              </div>
            </div>
          </div>

          <div className="modal-section">
            <h4>입금 정보</h4>
            <div className="info-grid">
              <div>
                <label>은행</label>
                {isEditing ? (
                  <select name="bank" value={editableData.bank} onChange={handleDataChange}>
                    <option value="">은행 선택</option>
                    {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                ) : (
                  <p>{currentReview.bank || '-'}</p>
                )}
              </div>
              <div>
                <label>계좌번호</label>
                {isEditing ? (
                  <input name="bankNumber" value={editableData.bankNumber} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.bankNumber || '-'}</p>
                )}
              </div>
              <div>
                <label>예금주</label>
                {isEditing ? (
                  <input name="accountHolderName" value={editableData.accountHolderName} onChange={handleDataChange} />
                ) : (
                  <p>{currentReview.accountHolderName || '-'}</p>
                )}
              </div>
            </div>
          </div>

        <div className="modal-section">
          <h4>제출된 이미지 (구매폼)</h4>
          {/* ▼▼▼ 여러 이미지를 표시하도록 로직 수정 ▼▼▼ */}
          <div className="image-grid">
              {initialImageFields.flatMap(({ key, label }) => {
                const imageUrls = currentReview[key];
              if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
                return imageUrls.map((url, index) => (
                  <div key={`${key}-${index}`} className="image-item">
                    <label>{label}</label>
                    <img
                      src={url}
                      alt={`${label} ${index + 1}`}
                      className="thumb"
                      onClick={() => openImagePreview(url)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                ));
              }
              return [];
            })}
          </div>
          {/* ▲▲▲ 로직 수정 완료 ▲▲▲ */}
        </div>
        
          {currentReview.confirmImageUrls && currentReview.confirmImageUrls.length > 0 && (
          <div className="modal-section">
            <h4>리뷰 인증 이미지</h4>
            <div className="image-grid">
              {currentReview.confirmImageUrls.map((url, index) => (
                <div key={index} className="image-item">
                  <label>인증 이미지 {index + 1}</label>
                  <img
                    src={url}
                    alt={`리뷰 인증 ${index + 1}`}
                    className="thumb"
                    onClick={() => openImagePreview(url)}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    {imagePreview && (
      <div className="modal-back" onClick={closeImagePreview}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="close" onClick={closeImagePreview}>✖</button>
          <img src={imagePreview} alt="미리보기" style={{ width: '100%' }} />
        </div>
      </div>
    )}
    </>
  );
}
