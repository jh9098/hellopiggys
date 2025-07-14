// src/components/MemberDetailModal.jsx (24시간 표기 수정)

import React, { useState } from 'react';
import './ReviewDetailModal.css';

// [수정] 함수명을 formatTimestamp24h로 변경하고 옵션 추가
const formatTimestamp24h = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleString('ko-KR', { hour12: false });
}

export default function MemberDetailModal({ member, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  if (!member) return null;

  const filteredReviews = member.reviews?.filter((rev) =>
    JSON.stringify(rev).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="review-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✖</button>
        <h3>회원 상세 정보</h3>
        
        <div className="modal-section">
          <h4>본계정 정보</h4>
          <div className="info-grid">
            <div><label>이름</label><p>{member.mainAccountName || '-'}</p></div>
            <div><label>전화번호</label><p>{member.mainAccountPhone || '-'}</p></div>
            <div><label>총 참여 횟수</label><p>{member.reviews.length || 0}회</p></div>
            {/* [수정] 헬퍼 함수 사용 */}
            <div><label>최근 참여일</label><p>{formatTimestamp24h(member.lastSubmissionDate)}</p></div>
          </div>
        </div>

        <div className="modal-section">
          <h4>참여 이력 (최신순)</h4>
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="내용 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '4px' }}
            />
          </div>
          <div className="sub-account-detail-list">
            {filteredReviews && filteredReviews.length > 0 ? (
              filteredReviews.map(review => (
                <div key={review.id} className="sub-account-detail-item">
                  <p style={{ fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>
                    {/* [수정] 헬퍼 함수 사용 */}
                    {formatTimestamp24h(review.createdAt)} 제출
                  </p>

                  <div className="info-grid half">
                    <div><label>상품명</label><p>{review.productName || '-'}</p></div>
                    <div><label>리뷰 종류</label><p>{review.paymentType || '-'}</p></div>
                  </div>

                  {review.subAccountInfo && (
                    <>
                      <h5 style={{ marginTop: '15px', marginBottom: '5px' }}>리뷰 참여 계정</h5>
                      <div className="info-grid half">
                        <div><label>이름</label><p>{review.subAccountInfo.name || '-'}</p></div>
                        <div><label>전화번호</label><p>{review.subAccountInfo.phoneNumber || '-'}</p></div>
                        <div className="full-width"><label>주소</label><p>{review.subAccountInfo.address || '-'}</p></div>
                        <div><label>은행</label><p>{review.subAccountInfo.bank || '-'}</p></div>
                        <div><label>계좌번호</label><p>{review.subAccountInfo.bankNumber || '-'}</p></div>
                        <div><label>예금주</label><p>{review.subAccountInfo.accountHolderName || '-'}</p></div>
                      </div>
                    </>
                  )}
                  
                  <h5 style={{ marginTop: '15px', marginBottom: '5px' }}>제출된 데이터</h5>
                  <div className="info-grid half">
                    <div><label>주문번호</label><p>{review.orderNumber || '-'}</p></div>
                    <div><label>금액</label><p>{review.rewardAmount ? Number(review.rewardAmount).toLocaleString() + '원' : '-'}</p></div>
                    <div><label>쿠팡 ID</label><p>{review.participantId || '-'}</p></div>
                  </div>
                </div>
              ))
            ) : (
              <p>{searchTerm ? '검색 결과가 없습니다.' : '참여 이력이 없습니다.'}</p>
            )}
          </div>
        </div>
      </div>
    </div>  
  );
}