// src/pages/MyReviews.jsx (구매폼 작성 버튼 추가)

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth, onAuthStateChanged, db,
  collection, query, where, orderBy, getDocs, doc, getDoc,
  updateDoc, ref, uploadBytes, getDownloadURL, deleteField, deleteDoc,
  getStorageInstance
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import './MyReviews.css';

function GuideToggle({ text }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const preview = lines.slice(0, 4).join('\n');
  const hasMore = lines.length > 4;
  return (
    <div className="guide-box">
      <strong>가이드:</strong>
      <p>{expanded || !hasMore ? text : preview}</p>
      {hasMore && (
        <button className="toggle-btn" onClick={() => setExpanded(!expanded)}>
          {expanded ? '접기 ▲' : '더보기 ▼'}
        </button>
      )}
    </div>
  );
}

const getStatusInfo = (review) => {
  const { status } = review;
  switch (status) {
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

const initialImageFields = [
  { key: 'keywordAndLikeImagesUrls', label: '키워드 & 찜 인증' },
  { key: 'orderImageUrls', label: '구매 인증' },
  { key: 'cashcardImageUrls', label: '현영/매출전표' },
];

export default function MyReviews() {
  const navigate = useNavigate();
  const storage = getStorageInstance();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [modalType, setModalType] = useState(null);
  const [currentReview, setCurrentReview] = useState(null); 
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState({});
  const [files, setFiles] = useState([]);
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
          const reviewsWithDetails = await Promise.all(snap.docs.map(async (d) => {
            const reviewData = { id: d.id, ...d.data() };
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
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => auth.signOut();
  const handleLoginSuccess = () => setIsLoginModalOpen(false);
  const openModal = (type, review) => { setCurrentReview(review); setModalType(type); setIsEditing(false); };
  const closeModal = () => { setModalType(null); setCurrentReview(null); setFiles([]); setUploading(false); setIsEditing(false); };
  const openImagePreview = (url) => setImagePreview(url);
  const closeImagePreview = () => setImagePreview(null);
  
  const handleEdit = () => {
    setIsEditing(true);
    setEditableData({ ...currentReview });
  };
  
  const handleCancelEdit = () => setIsEditing(false);

  const handleDeleteReview = async (id) => {
    if (!window.confirm('이 리뷰를 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.')) return;
    try {
      await deleteDoc(doc(db, 'reviews', id));
      setRows(rows.filter((row) => row.id !== id));
      alert('리뷰가 삭제되었습니다.');
    } catch (err) {
      console.error('리뷰 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };
  
  // 숫자만 입력되도록 필터링하는 로직 추가
  const handleDataChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber' || name === 'bankNumber' || name === 'orderNumber' || name === 'rewardAmount') {
      setEditableData({ ...editableData, [name]: value.replace(/[^0-9]/g, '') });
    } else {
      setEditableData({ ...editableData, [name]: value });
    }
  };

  const onFile = (e) => setFiles(Array.from(e.target.files || []));
  
  const handleSave = async () => {
    if (!currentReview) return;
    setUploading(true);
    try {
      if (currentReview.subAccountId) {
        const subAccountRef = doc(db, "subAccounts", currentReview.subAccountId);
        await updateDoc(subAccountRef, { name: editableData.name, phoneNumber: editableData.phoneNumber, address: editableData.address, bank: editableData.bank, bankNumber: editableData.bankNumber, accountHolderName: editableData.accountHolderName });
      }
      const fieldsToUpdateInReview = { rewardAmount: editableData.rewardAmount, orderNumber: editableData.orderNumber, participantId: editableData.participantId };
      await updateDoc(doc(db, 'reviews', currentReview.id), fieldsToUpdateInReview);
      const updatedRows = rows.map(row => row.id === currentReview.id ? { ...row, ...editableData, subAccountInfo: {...row.subAccountInfo, ...editableData} } : row);
      setRows(updatedRows);
      setCurrentReview({ ...currentReview, ...editableData, subAccountInfo: {...currentReview.subAccountInfo, ...editableData} });
      alert('수정이 완료되었습니다.');
      setIsEditing(false);
    } catch (e) {
      alert('수정 실패: ' + e.message);
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

  if (loading) return <p style={{ padding: 24, textAlign: 'center' }}>데이터를 불러오는 중...</p>;
  if (!currentUser) {
    return (
      <div className="my-wrap" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>내 리뷰 목록</h2>
        <p>리뷰를 확인하려면 로그인이 필요합니다.</p>
        <button className="login-open-btn" onClick={() => setIsLoginModalOpen(true)}>
          로그인 / 회원가입
        </button>
        {isLoginModalOpen && (
          <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    );
  }

  return (
    <>
    <div className="my-wrap">
      {/* ▼▼▼ 이 부분에 버튼 추가 ▼▼▼ */}
      <div className="page-header">
        <h2>내 리뷰 목록</h2>
        <div className="header-actions">
          <button className="action-btn" onClick={() => navigate('/link')}>
            구매폼 작성
          </button>
          <button className="logout" onClick={handleLogout}>
            로그아웃 ➡
          </button>
        </div>
      </div>
      {/* ▲▲▲ 버튼 추가 완료 ▲▲▲ */}

      {rows.length === 0 ? <p>작성한 리뷰가 없습니다.</p> : rows.map((r) => {
        const statusInfo = getStatusInfo(r);
        const participantName = r.subAccountInfo?.name || r.mainAccountInfo?.name || '알 수 없음';
        const participantType = r.subAccountInfo ? participantName : '본계정';
        return (
          <div className={`card ${statusInfo.className}`} key={r.id}>
            <div className="card-head"><div><span className="badge">{statusInfo.text}</span><span className="badge secondary">{participantType}</span></div><span className="timestamp">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</span></div>
            {r.productInfo && (
              <div className="product-details">
                <h4>{r.productInfo.productName}</h4>
                <p>
                  <strong>결제 종류:</strong> {r.productInfo.reviewType}
                </p>
                {r.productInfo.guide && <GuideToggle text={r.productInfo.guide} />}
              </div>
            )}
            {statusInfo.reason && <div className="rejection-reason"><strong>반려 사유:</strong> {statusInfo.reason}</div>}
            <div className="price">{Number(r.rewardAmount || 0).toLocaleString()}원</div>
            <div className="btn-wrap">
              <button onClick={() => openModal('detail', r)}>제출 내역 상세</button>
              <button className="outline" onClick={() => openModal('upload', r)} disabled={r.status !== 'submitted' && r.status !== 'rejected'}>리뷰 인증하기</button>
              <button className="delete" onClick={() => handleDeleteReview(r.id)}>삭제</button>
            </div>
          </div>
        );
      })}
      
      {modalType && (
        <div className="modal-back">
          <div className="modal">
            <button className="close" onClick={closeModal}>✖</button>
            {modalType === 'detail' && (
              <div className="detail-view">
                <h3>제출 내역 상세</h3>
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
                {[
                  { key: 'orderNumber', label: '주문번호' }, 
                  { key: 'participantId', label: '쿠팡 ID'},
                  { key: 'address', label: '주소' }, 
                  { key: 'bankNumber', label: '계좌번호' }, 
                  { key: 'accountHolderName', label: '예금주' }, 
                  { key: 'rewardAmount', label: '금액' }
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
                
                {initialImageFields.map(({ key, label }) => ( currentReview?.[key] && currentReview[key].length > 0 && (
                  <div className="field full-width" key={key}>
                    <label>{label}</label>
                    <div className="preview-container">
                      {currentReview[key].map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`${label} ${i + 1}`}
                          className="thumb"
                          onClick={() => openImagePreview(url)}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </div>
                  </div>
                )))}
                
                {currentReview.confirmImageUrls && currentReview.confirmImageUrls.length > 0 && (
                  <div className="field full-width">
                    <label>리뷰 완료 인증</label>
                    <div className="preview-container">
                      {currentReview.confirmImageUrls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt={`리뷰인증 ${i + 1}`}
                          className="thumb"
                          onClick={() => openImagePreview(url)}
                          style={{ cursor: 'pointer' }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="modal-actions">
                  {isEditing ? (
                    <>
                      <button onClick={handleSave} disabled={uploading}>{uploading ? '저장 중...' : '저장'}</button>
                      <button onClick={handleCancelEdit} className="secondary">취소</button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleEdit} disabled={currentReview?.status === 'verified' || currentReview?.status === 'settled'}>수정</button>
                      <button onClick={closeModal} className="secondary">닫기</button>
                    </>
                  )}
                </div>
              </div>
            )}
            {modalType === 'upload' && (
              <>
                <h3>리뷰 인증 이미지 업로드</h3>
                <input type="file" accept="image/*" multiple onChange={onFile} />
                <button onClick={uploadConfirm} disabled={uploading || files.length === 0} style={{ marginTop: 16 }}>{uploading ? '업로드 중…' : '완료'}</button>
              </>
            )}
          </div>
        </div>
      )}
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
  );}