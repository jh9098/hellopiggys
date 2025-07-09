// src/components/MemberDetailModal.jsx (신규 파일)

import React from 'react';
import './ReviewDetailModal.css'; // 기존 모달 CSS를 재사용합니다.

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleString();
}

export default function MemberDetailModal({ member, onClose }) {
  if (!member) return null;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="review-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✖</button>
        <h3>회원 상세 정보</h3>
        
        {/* --- 본계정 정보 --- */}
        <div className="modal-section">
          <h4>본계정 정보</h4>
          <div className="info-grid">
            <div><label>이름</label><p>{member.mainAccountName || '-'}</p></div>
            <div><label>전화번호</label><p>{member.mainAccountPhone || '-'}</p></div>
            <div><label>총 참여 횟수</label><p>{member.totalSubmissions || 0}회</p></div>
            <div><label>최근 참여일</label><p>{formatDate(member.lastSubmissionDate)}</p></div>
          </div>
        </div>

        {/* --- 타계정(리뷰 참여) 목록 --- */}
        {member.subAccounts && Object.keys(member.subAccounts).length > 0 && (
          <div className="modal-section">
            <h4>참여 계정 목록 (타계정)</h4>
            <div className="sub-account-detail-list">
              {Object.values(member.subAccounts).map(sub => (
                <div key={sub.id} className="sub-account-detail-item">
                  <div className="info-grid">
                    <div><label>이름</label><p>{sub.name || '-'}</p></div>
                    <div><label>전화번호</label><p>{sub.phoneNumber || '-'}</p></div>
                    <div><label>참여 횟수</label><p>{sub.submissionCount || 0}회</p></div>
                    <div><label>은행</label><p>{sub.bank || '-'}</p></div>
                    <div><label>계좌번호</label><p>{sub.bankNumber || '-'}</p></div>
                    <div><label>예금주</label><p>{sub.accountHolderName || '-'}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}