// src/components/ReviewDetailModal.jsx (오류 수정 최종본)

import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import {
  db,
  doc,
  updateDoc,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  arrayRemove,
} from '../firebaseConfig';
import './ReviewDetailModal.css';

// 이미지 필드 정의 (my-reviews와 동일하게)
const imageFields = [
  { key: 'keywordAndLikeImagesUrls', label: '키워드 & 찜 인증' },
  { key: 'orderImageUrls', label: '구매 인증' },
  { key: 'cashcardImageUrls', label: '현영/매출전표' },
  { key: 'confirmImageUrls', label: '리뷰 완료 인증' },
];

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
  const [editImages, setEditImages] = useState({});
  const [imagesToDelete, setImagesToDelete] = useState({});
  const [uploading, setUploading] = useState(false);

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

  const onEditFileChange = async (e) => {
    const { name, files } = e.target;
    if (!files || files.length === 0) return;

    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
    const processed = [];
    for (const file of files) {
      try {
        processed.push(await imageCompression(file, options));
      } catch (err) {
        console.warn(`이미지 압축 실패. 원본 사용: ${file.name}`, err);
        processed.push(file);
      }
    }
    const selected = processed.slice(0, 5);
    setEditImages(prev => ({ ...prev, [name]: selected }));
  };

  const handleDeleteExistingImage = (fieldKey, urlToDelete) => {
    if (!window.confirm('이 이미지를 삭제하시겠습니까? 저장을 눌러야 최종 반영됩니다.')) return;
    setCurrentReview(prev => ({
      ...prev,
      [fieldKey]: prev[fieldKey].filter(url => url !== urlToDelete),
    }));
    setImagesToDelete(prev => ({
      ...prev,
      [fieldKey]: [...(prev[fieldKey] || []), urlToDelete],
    }));
  };

  const handleSave = async () => {
    setUploading(true);
    try {
      if (currentReview.subAccountId) {
        await updateDoc(doc(db, 'subAccounts', currentReview.subAccountId), {
          name: editableData.name,
          phoneNumber: editableData.phoneNumber,
          address: editableData.address,
          bank: editableData.bank,
          bankNumber: editableData.bankNumber,
          accountHolderName: editableData.accountHolderName,
        });
      }

      const fieldsToUpdateInReview = {
        participantId: editableData.participantId,
        orderNumber: editableData.orderNumber,
        rewardAmount: editableData.rewardAmount,
      };

      for (const fieldKey in imagesToDelete) {
        if (imagesToDelete[fieldKey]?.length > 0) {
          fieldsToUpdateInReview[fieldKey] = arrayRemove(...imagesToDelete[fieldKey]);
        }
      }

      const imageUrlMap = {};
      for (const { key } of imageFields) {
        if (editImages[key] && editImages[key].length > 0) {
          const newUrls = [];
          for (const f of editImages[key]) {
            const storageRef = ref(storage, `reviewImages/${Date.now()}_${f.name}`);
            await uploadBytes(storageRef, f);
            newUrls.push(await getDownloadURL(storageRef));
          }
          imageUrlMap[key] = [...(currentReview[key] || []), ...newUrls];
        }
      }

      const finalUpdateData = { ...fieldsToUpdateInReview, ...imageUrlMap };
      await updateDoc(doc(db, 'reviews', currentReview.id), finalUpdateData);

      const updatedReviewData = { ...currentReview, ...editableData, ...imageUrlMap };
      setCurrentReview(updatedReviewData);

      alert('수정이 완료되었습니다.');
      setIsEditing(false);
      setEditImages({});
      setImagesToDelete({});
    } catch (err) {
      alert('수정 실패: ' + err.message);
    } finally {
      setUploading(false);
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
    setEditImages({});
    setImagesToDelete({});
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
          {imageFields.slice(0,3).map(({ key, label }) => (
            <div className="field full-width" key={key}>
              <label>{label}</label>
              {isEditing && (
                <>
                  <input type="file" accept="image/*" name={key} multiple onChange={onEditFileChange} />
                  <div className="file-list">
                    {editImages[key] && editImages[key].length > 0 ? (
                      editImages[key].map((file, i) => (
                        <div key={`${file.name}-${i}`}>{i + 1}. {file.name}</div>
                      ))
                    ) : (
                      <div className="file-list-placeholder">새로 추가할 파일 없음</div>
                    )}
                  </div>
                </>
              )}
              {currentReview[key] && currentReview[key].length > 0 && (
                <div className="preview-container">
                  {currentReview[key].map((url, i) => (
                    <div key={i} className="image-item-wrapper">
                      <img
                        src={url}
                        alt={`${label} ${i + 1}`}
                        className="thumb"
                        onClick={() => openImagePreview(url)}
                        style={{ cursor: 'pointer' }}
                      />
                      {isEditing && (
                        <button className="delete-image-btn" onClick={() => handleDeleteExistingImage(key, url)}>✖</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
          <div className="modal-section">
            <h4>리뷰 인증 이미지</h4>
            {isEditing && (
              <>
                <input
                  type="file"
                  accept="image/*"
                  name="confirmImageUrls"
                  multiple
                  onChange={onEditFileChange}
                />
                <div className="file-list">
                  {editImages.confirmImageUrls && editImages.confirmImageUrls.length > 0 ? (
                    editImages.confirmImageUrls.map((file, i) => (
                      <div key={`${file.name}-${i}`}>{i + 1}. {file.name}</div>
                    ))
                  ) : (
                    <div className="file-list-placeholder">새로 추가할 파일 없음</div>
                  )}
                </div>
              </>
            )}
            {currentReview.confirmImageUrls && currentReview.confirmImageUrls.length > 0 && (
              <div className="preview-container">
                {currentReview.confirmImageUrls.map((url, index) => (
                  <div key={index} className="image-item-wrapper">
                    <img
                      src={url}
                      alt={`리뷰 인증 ${index + 1}`}
                      className="thumb"
                      onClick={() => openImagePreview(url)}
                      style={{ cursor: 'pointer' }}
                    />
                    {isEditing && (
                      <button
                        className="delete-image-btn"
                        onClick={() => handleDeleteExistingImage('confirmImageUrls', url)}
                      >
                        ✖
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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
