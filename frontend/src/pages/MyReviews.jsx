// src/pages/MyReviews.jsx (최종 수정본)

import { useEffect, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  auth,
  onAuthStateChanged,
  db,
  storage,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteField,
  deleteDoc,
  arrayRemove,
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import './MyReviews.css';

const formatTimestamp24h = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  return new Date(timestamp.seconds * 1000).toLocaleString('ko-KR', { hour12: false });
};

function GuideToggle({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const lines = text.split('\n');
  const preview = lines.slice(0, 4).join('\n');
  const hasMore = lines.length > 4;
  return (
    <div className="guide-box">
      <strong>가이드:</strong>
      <p style={{ whiteSpace: 'pre-line' }}>{expanded || !hasMore ? text : preview}</p>
      {hasMore && (
        <Button className="toggle-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '접기 ▲' : '더보기 ▼'}
        </Button>
      )}
    </div>
  );
}

// 동적 상태 판별 로직
const getDynamicStatus = (review) => {
  const { status, keywordAndLikeImagesUrls, cashcardImageUrls } = review;
  if (['review_completed', 'verified', 'rejected', 'settled'].includes(status)) {
    return status;
  }
  const hasRequiredImages =
    keywordAndLikeImagesUrls?.length > 0 && cashcardImageUrls?.length > 0;
  return hasRequiredImages ? 'submitted' : 'buying';
};

const getStatusInfo = (review) => {
  const status = getDynamicStatus(review);
  switch (status) {
    case 'buying': return { text: '구매중', className: 'buying' };
    case 'review_completed': return { text: '리뷰 완료', className: 'review-completed' };
    case 'verified': return { text: '리뷰 인증 완료', className: 'verified' };
    case 'rejected': return { text: `리뷰 반려됨`, className: 'rejected', reason: review.rejectionReason };
    case 'settled': return { text: '정산 완료', className: 'settled' };
    case 'submitted': default: return { text: '구매 완료', className: 'submitted' };
  }
};

const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

const imageFields = [
  { key: 'keywordAndLikeImagesUrls', label: '키워드 & 찜 인증' },
  { key: 'orderImageUrls', label: '구매 인증' },
  { key: 'cashcardImageUrls', label: '현영/매출전표' },
  { key: 'confirmImageUrls', label: '리뷰 완료 인증' },
];

export default function MyReviews() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [activeFilter, setActiveFilter] = useState('buying');
  const [products, setProducts] = useState([]);
  const [modalType, setModalType] = useState(null);
  const [currentReview, setCurrentReview] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState({});
  const [files, setFiles] = useState([]);
  const [editImages, setEditImages] = useState({});
  const [imagesToDelete, setImagesToDelete] = useState({});
  const [uploading, setUploading] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsLoginModalOpen(false);
        setLoading(true);
        try {
          const q = query(collection(db, 'reviews'), where('mainAccountId', '==', user.uid), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          const reviewsWithDetails = await Promise.all(snap.docs.map(async (docSnapshot) => {
            const reviewData = { id: docSnapshot.id, ...docSnapshot.data() };
            if (reviewData.productId) {
              const productRef = doc(db, 'products', reviewData.productId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) { reviewData.productInfo = productSnap.data(); }
            }
            if (reviewData.subAccountId) {
              const subDocRef = doc(db, 'subAccounts', reviewData.subAccountId);
              const subDocSnap = await getDoc(subDocRef);
              if (subDocSnap.exists()) {
                const subData = subDocSnap.data();
                delete subData.createdAt;
                reviewData.subAccountInfo = subData;
                Object.assign(reviewData, subData);
              }
            }
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) { reviewData.mainAccountInfo = userSnap.data(); }
            return reviewData;
          }));
          setRows(reviewsWithDetails);
        } catch (error) {
          console.error("리뷰를 불러오는 중 오류 발생:", error);
          alert('리뷰 정보를 가져오는 데 실패했습니다.');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
        setRows([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeFilter === 'all') {
      setFilteredRows(rows);
    } else {
      const filtered = rows.filter(row => getDynamicStatus(row) === activeFilter);
      setFilteredRows(filtered);
    }
  }, [rows, activeFilter]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), where('progressStatus', '==', '진행중'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('상품 목록 로딩 실패:', err);
      }
    };
    fetchProducts();
  }, []);
  
  const resetModalState = () => {
    setModalType(null);
    setCurrentReview(null);
    setFiles([]);
    setEditImages({});
    setImagesToDelete({});
    setUploading(false);
    setIsEditing(false);
  };

  const handleLogout = () => auth.signOut();
  const handleLoginSuccess = () => setIsLoginModalOpen(false);
  const openModal = (type, review) => { setCurrentReview(review); setModalType(type); setIsEditing(false); };
  const closeModal = () => { resetModalState(); };
  const openImagePreview = (url) => setImagePreview(url);
  const closeImagePreview = () => setImagePreview(null);
  
  const handleEdit = () => {
    setIsEditing(true);
    setEditableData({
      ...currentReview,
      productId: currentReview.productId,
      productName: currentReview.productInfo?.productName,
      reviewType: currentReview.productInfo?.reviewType,
    });
    setEditImages({});
    setImagesToDelete({});
  };

  const handleCancelEdit = () => { setIsEditing(false); setEditImages({}); setImagesToDelete({}); };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('이 리뷰를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) return;
    try {
      await deleteDoc(doc(db, 'reviews', reviewId));
      setRows(rows.filter((row) => row.id !== reviewId));
      alert('리뷰가 삭제되었습니다.');
    } catch (err) {
      console.error('리뷰 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };
  
  const handleDataChange = (e) => {
    const { name, value } = e.target;
    if (['phoneNumber', 'bankNumber', 'orderNumber', 'rewardAmount'].includes(name)) {
      setEditableData({ ...editableData, [name]: value.replace(/[^0-9]/g, '') });
    } else {
      setEditableData({ ...editableData, [name]: value });
    }
  };

  const handleProductChange = (e) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId);
    setEditableData(prev => ({
      ...prev,
      productId,
      productName: product?.productName || '',
      reviewType: product?.reviewType || ''
    }));
  };

  const onFile = (e) => setFiles(Array.from(e.target.files || []));
  
  const onEditFileChange = async (e) => {
    const { name, files: inputFiles } = e.target;
    if (!inputFiles || inputFiles.length === 0) return;
    
    const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true };
    const processedFiles = [];
    for (const file of inputFiles) {
      try {
        processedFiles.push(await imageCompression(file, options));
      } catch (err) {
        console.warn(`이미지 압축 실패. 원본 사용: ${file.name}`, err);
        processedFiles.push(file);
      }
    }
    const selectedFiles = processedFiles.slice(0, 5);
    setEditImages(prev => ({ ...prev, [name]: selectedFiles }));
  };

  const handleDeleteExistingImage = (fieldKey, urlToDelete) => {
    if (!window.confirm('이 이미지를 삭제하시겠습니까? 저장을 눌러야 최종 반영됩니다.')) return;
    setCurrentReview(prev => ({
      ...prev,
      [fieldKey]: prev[fieldKey].filter(url => url !== urlToDelete)
    }));
    setImagesToDelete(prev => ({
      ...prev,
      [fieldKey]: [...(prev[fieldKey] || []), urlToDelete]
    }));
  };

  const handleSave = async () => {
    if (!currentReview) return;
    setUploading(true);
    try {
      // 1. subAccount 업데이트 데이터 준비
      const subAccountUpdateData = {
        name: editableData.name,
        phoneNumber: editableData.phoneNumber,
        address: editableData.address,
        bank: editableData.bank,
        bankNumber: editableData.bankNumber,
        accountHolderName: editableData.accountHolderName,
      };

      // 2. subAccount가 있으면 Firestore 업데이트
      if (currentReview.subAccountId) {
        const subAccountRef = doc(db, "subAccounts", currentReview.subAccountId);
        await updateDoc(subAccountRef, subAccountUpdateData);
      }
      
      // 3. review 문서 업데이트 데이터 준비 (기본 정보)
      const reviewUpdateData = {
        rewardAmount: editableData.rewardAmount,
        orderNumber: editableData.orderNumber,
        participantId: editableData.participantId,
        productId: editableData.productId,
        productName: editableData.productName || '상품명 없음',
        reviewType: editableData.reviewType || '현영',
      };

      // 4. 이미지 업데이트 로직 개선
      for (const { key } of imageFields) {
        // UI에서 삭제 반영된 URL 목록
        const existingUrls = currentReview[key]?.filter(url => !imagesToDelete[key]?.includes(url)) || [];
        
        // 새로 업로드할 이미지 URL 획득
        const newUrls = [];
        if (editImages[key] && editImages[key].length > 0) {
          for (const file of editImages[key]) {
            const storageRef = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            newUrls.push(await getDownloadURL(storageRef));
          }
        }
        // 최종 URL 목록을 DB 업데이트 객체에 할당
        reviewUpdateData[key] = [...existingUrls, ...newUrls];
      }

      // 5. status 업데이트
      if (currentReview.status === 'uploading_images') {
        reviewUpdateData.status = 'submitted';
      }

      // 6. Firestore에 review 문서 최종 업데이트
      await updateDoc(doc(db, 'reviews', currentReview.id), reviewUpdateData);
      
      // 7. 로컬 React 상태를 DB와 '완벽히' 일치시키기
      const updatedRows = rows.map(row => {
        if (row.id !== currentReview.id) return row;

        const newSubAccountInfo = row.subAccountInfo ? { ...row.subAccountInfo, ...subAccountUpdateData } : undefined;

        // DB와 동기화된 깨끗한 최종 데이터로 새 review 객체 생성
        const updatedReview = {
          ...row, // 기존 데이터 (createdAt 등)
          ...editableData, // 폼에서 수정한 기본 정보
          ...reviewUpdateData, // DB에 업데이트된 최종 정보(이미지 URL, status 등 포함)
          productInfo: products.find(p => p.id === editableData.productId) || row.productInfo,
          subAccountInfo: newSubAccountInfo,
        };
        
        // subAccount 정보가 있는 경우 최상위 속성도 동기화
        if (newSubAccountInfo) {
          Object.assign(updatedReview, newSubAccountInfo);
        }
        return updatedReview;
      });
      
      setRows(updatedRows);
      
      // 모달에 표시되는 currentReview도 DB와 동기화된 최신 데이터로 업데이트
      const updatedCurrentReview = updatedRows.find(row => row.id === currentReview.id);
      setCurrentReview(updatedCurrentReview);
      
      alert('수정이 완료되었습니다.');
      setIsEditing(false);
      setEditImages({});
      setImagesToDelete({});
    } catch (e) {
      alert('수정 실패: ' + e.message);
      console.error("수정 중 오류 발생:", e);
    } finally {
      setUploading(false);
    }
  };
  
  const uploadConfirm = async () => {
    if (!currentReview || files.length === 0) return alert('파일을 선택하세요');
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const storageRef = ref(storage, `confirmImages/${Date.now()}_${f.name}`);
        await uploadBytes(storageRef, f);
        urls.push(await getDownloadURL(storageRef));
      }
      const updatedData = { confirmImageUrls: urls, confirmedAt: new Date(), status: 'review_completed', rejectionReason: deleteField() };
      await updateDoc(doc(db, 'reviews', currentReview.id), updatedData);
      const updatedRows = rows.map(row => (row.id === currentReview.id) ? { ...row, ...updatedData } : row);
      setRows(updatedRows);
      alert('리뷰를 제출했습니다.');
      closeModal();
    } catch (e) {
      alert('업로드 실패: ' + e.message);
    } finally {
      setUploading(false); setFiles([]);
    }
  };

  const filterButtons = [
    { key: 'all', label: '전체' },
    { key: 'buying', label: '구매중' },
    { key: 'submitted', label: '구매완료' },
    { key: 'review_completed', label: '리뷰완료' },
    { key: 'verified', label: '리뷰인증완료' },
    { key: 'rejected', label: '리뷰반려' },
    { key: 'settled', label: '정산완료' },
  ];

  if (loading) return <p style={{ padding: 24, textAlign: 'center' }}>데이터를 불러오는 중...</p>;
  if (!currentUser) {
    return (
      <div className="my-wrap" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>내 리뷰 목록</h2>
        <p>리뷰를 확인하려면 로그인이 필요합니다.</p>
        <Button className="login-open-btn" onClick={() => setIsLoginModalOpen(true)}>
          로그인 / 회원가입
        </Button>
        {isLoginModalOpen && (
          <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    );
  }

  return (
    <>
    <div className="my-wrap">
      <div className="page-header">
        <h2>내 리뷰 목록</h2>
        <Button className="logout-btn" onClick={handleLogout}>
          로그아웃 ➡
        </Button>
      </div>

      <div className="filter-buttons">
        {filterButtons.map(filter => (
          <Button
            key={filter.key}
            className={`filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
            onClick={() => setActiveFilter(filter.key)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      {filteredRows.length === 0 ? <p style={{ textAlign: 'center', marginTop: '40px' }}>해당 상태의 리뷰가 없습니다.</p> : filteredRows.map((r) => {
        const statusInfo = getStatusInfo(r);
        const participantName = r.subAccountInfo?.name || r.mainAccountInfo?.name || '알 수 없음';
        const participantType = r.subAccountInfo ? participantName : '본계정';
        return (
          <div className={`card ${statusInfo.className}`} key={r.id}>
            <div className="card-head"><div><span className="badge">{statusInfo.text}</span><span className="badge secondary">{participantType}</span></div><span className="timestamp">{formatTimestamp24h(r.createdAt)}</span></div>
            {r.productInfo && (
              <div className="product-details">
                <h4>{r.productInfo.productName}</h4>
                <p>
                  <strong>결제 종류:</strong> {r.productInfo.reviewType}
                </p>
                {r.productType && ( <p><strong>상품 종류:</strong> {r.productType}</p> )}
                {r.reviewOption && ( <p><strong>리뷰 종류:</strong> {r.reviewOption}</p> )}
                {r.productInfo.guide && <GuideToggle text={r.productInfo.guide} />}
              </div>
            )}
            {statusInfo.reason && <div className="rejection-reason"><strong>반려 사유:</strong> {statusInfo.reason}</div>}
            <div className="price">{Number(r.rewardAmount || 0).toLocaleString()}원</div>
            <div className="btn-wrap">
              <Button onClick={() => openModal('detail', r)}>제출 내역 상세(수정)</Button>
              <Button className="outline" onClick={() => openModal('upload', r)} disabled={getDynamicStatus(r) !== 'submitted' && getDynamicStatus(r) !== 'rejected'}>리뷰 인증하기</Button>
              <Button className="delete" onClick={() => handleDeleteReview(r.id)}>삭제</Button>
            </div>
          </div>
        );
      })}
      
      {modalType && (
        <div className="modal-back">
          <div className="modal">
            <Button className="close" onClick={closeModal}>✖</Button>
            {modalType === 'detail' && currentReview && (
              <div className="detail-view">
                <h3>제출 내역 상세(수정)</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>구매자(수취인)</label>
                    {isEditing ? <input name="name" value={editableData.name || ''} onChange={handleDataChange} /> : <p>{currentReview?.name}</p>}
                  </div>
                  <div className="field">
                    <label>전화번호</label>
                    {isEditing ? <input name="phoneNumber" value={editableData.phoneNumber || ''} onChange={handleDataChange} /> : <p>{currentReview?.phoneNumber}</p>}
                  </div>
                </div>
                <div className="field">
                  <label>상품명</label>
                  {isEditing ? (
                    <select name="productId" value={editableData.productId || ''} onChange={handleProductChange}>
                      <option value="">상품 선택</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.productName} ({p.reviewType})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p>{currentReview?.productInfo?.productName}</p>
                  )}
                </div>
                {[
                  { key: 'orderNumber', label: '주문번호' }, { key: 'participantId', label: '쿠팡 ID'},
                  { key: 'address', label: '주소' }, { key: 'bankNumber', label: '계좌번호' }, 
                  { key: 'accountHolderName', label: '예금주' }, { key: 'rewardAmount', label: '금액' }
                ].map(({ key, label }) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    {isEditing ? <input name={key} value={editableData[key] || ''} onChange={handleDataChange} /> : <p>{currentReview?.[key]}</p>}
                  </div>
                ))}
                <div className="field">
                  <label>은행</label>
                  {isEditing ? (
                    <select name="bank" value={editableData.bank || ''} onChange={handleDataChange}>
                      <option value="">은행 선택</option>
                      {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (<p>{currentReview?.bank}</p>)}
                </div>
                
                {imageFields.map(({ key, label }) => (
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
                    {currentReview?.[key] && currentReview[key].length > 0 && (
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
                              <Button
                                className="delete-image-btn"
                                onClick={() => handleDeleteExistingImage(key, url)}
                              >
                                ✖
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="modal-actions">
                  {isEditing ? (
                    <>
                      <Button onClick={handleSave} disabled={uploading}>{uploading ? '저장 중...' : '저장'}</Button>
                      <Button onClick={handleCancelEdit} className="secondary">취소</Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleEdit} disabled={currentReview?.status === 'verified' || currentReview?.status === 'settled'}>수정</Button>
                      <Button onClick={closeModal} className="secondary">닫기</Button>
                    </>
                  )}
                </div>
              </div>
            )}
            {modalType === 'upload' && (
              <>
                <h3>리뷰 인증 이미지 업로드</h3>
                <input type="file" accept="image/*" multiple onChange={onFile} />
                <Button onClick={uploadConfirm} disabled={uploading || files.length === 0} style={{ marginTop: 16 }}>{uploading ? '업로드 중…' : '완료'}</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
    {imagePreview && (
      <div className="modal-back" onClick={closeImagePreview}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <Button className="close" onClick={closeImagePreview}>✖</Button>
          <img src={imagePreview} alt="미리보기" style={{ width: '100%' }} />
        </div>
      </div>
    )}
    </>
  );
}