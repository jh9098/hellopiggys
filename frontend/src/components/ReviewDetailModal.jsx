// src/components/ReviewDetailModal.jsx (오류 수정 최종본)

import React from 'react';
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

export default function ReviewDetailModal({ review, onClose }) {
  if (!review) return null;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="review-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✖</button>
        <h3>리뷰 제출 내용 상세</h3>
        
        <div className="modal-section">
          <h4>기본 정보</h4>
          <div className="info-grid">
            <div><label>구매자(수취인)</label><p>{review.name || '-'}</p></div>
            <div><label>전화번호</label><p>{review.phoneNumber || '-'}</p></div>
            <div><label>주소</label><p>{review.address || '-'}</p></div>
            <div><label>참가자ID</label><p>{review.participantId || '-'}</p></div>
            <div><label>주문번호</label><p>{review.orderNumber || '-'}</p></div>
            <div><label>금액</label><p>{Number(review.rewardAmount || 0).toLocaleString()}원</p></div>
          </div>
        </div>

        <div className="modal-section">
          <h4>입금 정보</h4>
          <div className="info-grid">
            <div><label>은행</label><p>{review.bank || '-'}</p></div>
            <div><label>계좌번호</label><p>{review.bankNumber || '-'}</p></div>
            <div><label>예금주</label><p>{review.accountHolderName || '-'}</p></div>
          </div>
        </div>

        <div className="modal-section">
          <h4>제출된 이미지 (구매폼)</h4>
          {/* ▼▼▼ 여러 이미지를 표시하도록 로직 수정 ▼▼▼ */}
          <div className="image-grid">
            {initialImageFields.flatMap(({ key, label }) => {
              const imageUrls = review[key];
              if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
                return imageUrls.map((url, index) => (
                  <div key={`${key}-${index}`} className="image-item">
                    <label>{label}</label>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`${label} ${index + 1}`} className="thumb" />
                    </a>
                  </div>
                ));
              }
              return [];
            })}
          </div>
          {/* ▲▲▲ 로직 수정 완료 ▲▲▲ */}
        </div>
        
        {review.confirmImageUrls && review.confirmImageUrls.length > 0 && (
          <div className="modal-section">
            <h4>리뷰 인증 이미지</h4>
            <div className="image-grid">
              {review.confirmImageUrls.map((url, index) => (
                <div key={index} className="image-item">
                  <label>인증 이미지 {index + 1}</label>
                   <a href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={`리뷰 인증 ${index + 1}`} className="thumb" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}