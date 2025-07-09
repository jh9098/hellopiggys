// D:\hellopiggy\frontend\src\pages\MyReviews.jsx (최종 완성 버전)

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth,
  onAuthStateChanged,
  db,
  getStorageInstance,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteField,
  getDoc
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import './MyReviews.css';

const getStatusInfo = (review) => {
  const { status, confirmImageUrls, rejectionReason } = review;
  switch (status) {
    case 'review_completed': return { text: '리뷰 완료', className: 'review-completed' };
    case 'verified': return { text: '리뷰 인증 완료', className: 'verified' };
    case 'rejected': return { text: `리뷰 반려됨`, className: 'rejected', reason: rejectionReason };
    case 'settled': return { text: '정산 완료', className: 'settled' };
    case 'submitted':
    default:
      if (confirmImageUrls && confirmImageUrls.length > 0) {
        return { text: '리뷰 완료', className: 'review-completed' };
      }
      return { text: '구매 완료', className: 'submitted' };
  }
};

const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

export default function MyReviews() {
  const nav = useNavigate();
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsLoginModalOpen(false);
        try {
          const q = query(collection(db, 'reviews'), where('mainAccountId', '==', user.uid), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          const reviewsWithDetails = await Promise.all(snap.docs.map(async (d) => {
            const reviewData = { id: d.id, ...d.data() };
            if (reviewData.subAccountId) {
              const subDocRef = doc(db, 'subAccounts', reviewData.subAccountId);
              const subDocSnap = await getDoc(subDocRef);
              if (subDocSnap.exists()) {
                Object.assign(reviewData, subDocSnap.data());
              }
            }
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

  // ▼▼▼ 모든 핸들러 함수를 여기에 다시 정의합니다. ▼▼▼

  const handleLogout = () => { auth.signOut(); localStorage.clear(); };
  const handleLoginSuccess = () => { setIsLoginModalOpen(false); setLoading(true); };

  const openModal = (type, review) => {
    setCurrentReview(review);
    setModalType(type);
    setIsEditing(false);
  };

  const closeModal = () => {
    setModalType(null);
    setCurrentReview(null);
    setFiles([]);
    setUploading(false);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setEditableData({ ...currentReview });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDataChange = (e) => {
    setEditableData({ ...editableData, [e.target.name]: e.target.value });
  };

  const onFile = (e) => {
    setFiles(Array.from(e.target.files || []));
  };
  
  const handleSave = async () => {
    if (!currentReview) return;
    setUploading(true);
    try {
      const fieldsToUpdateInSubAccount = {
        name: editableData.name,
        phoneNumber: editableData.phoneNumber,
        address: editableData.address,
        bank: editableData.bank,
        bankNumber: editableData.bankNumber,
        accountHolderName: editableData.accountHolderName,
      };
      
      if (currentReview.subAccountId) {
          const subAccountRef = doc(db, "subAccounts", currentReview.subAccountId);
          await updateDoc(subAccountRef, fieldsToUpdateInSubAccount);
      }
      
      const fieldsToUpdateInReview = {
        rewardAmount: editableData.rewardAmount,
        orderNumber: editableData.orderNumber,
        participantId: editableData.participantId
      };
      await updateDoc(doc(db, 'reviews', currentReview.id), fieldsToUpdateInReview);

      const updatedRows = rows.map(row => row.id === currentReview.id ? { ...row, ...editableData } : row);
      setRows(updatedRows);
      setCurrentReview({ ...currentReview, ...editableData });
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
      const updatedData = { 
        confirmImageUrls: urls, 
        confirmedAt: new Date(),
        status: 'review_completed',
        rejectionReason: deleteField() 
      };
      await updateDoc(doc(db, 'reviews', currentReview.id), updatedData);
      const updatedRows = rows.map(row => {
        if (row.id === currentReview.id) {
          return { ...row, ...updatedData };
        }
        return row;
      });
      setRows(updatedRows);
      alert('리뷰를 제출했습니다.');
      closeModal();
    } catch (e) {
      alert('업로드 실패: ' + e.message);
    } finally {
      setUploading(false);
      setFiles([]);
    }
  };
  // ▲▲▲ 모든 핸들러 함수를 여기에 다시 정의합니다. ▲▲▲

  if (loading) return <p style={{ padding: 24, textAlign: 'center' }}>데이터를 불러오는 중...</p>;
  
  if (!currentUser) {
    return (
      <div className="my-wrap" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>내 리뷰 목록</h2>
        <p>리뷰를 확인하려면 로그인이 필요합니다.</p>
        <button onClick={() => setIsLoginModalOpen(true)}>로그인 / 회원가입</button>
        {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />}
      </div>
    );
  }

  return (
    <div className="my-wrap">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
        <h2>내 리뷰 목록</h2>
        <button className="logout" onClick={handleLogout}>로그아웃 ➡</button>
      </div>

      {rows.length === 0 ? <p>작성한 리뷰가 없습니다.</p> : rows.map((r) => {
        const statusInfo = getStatusInfo(r);
        return (
          <div className={`card ${statusInfo.className}`} key={r.id}>
            <div className="card-head"><span className="badge">{statusInfo.text}</span><span className="timestamp">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</span></div>
            <div className="btn-wrap">
              <button onClick={() => openModal('guide', r)}>진행 가이드</button>
              <button onClick={() => openModal('detail', r)}>구매 내역</button>
              <button className="outline" onClick={() => openModal('upload', r)} disabled={r.status === 'settled' || r.status === 'verified'}>리뷰 인증하기</button>
            </div>
            <div className="product">{r.participantId || r.title || '제목 없음'}</div>
            {statusInfo.reason && <div className="rejection-reason"><strong>반려 사유:</strong> {statusInfo.reason}</div>}
            <div className="price">{Number(r.rewardAmount || 0).toLocaleString()}원</div>
          </div>
        );
      })}
      
      {modalType && (
        <div className="modal-back" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={closeModal}>✖</button>
            {modalType === 'guide' && (<><h3>진행 가이드</h3><p style={{ whiteSpace: 'pre-line' }}>{currentReview?.content || '준비 중입니다.'}</p></>)}
            {modalType === 'detail' && (
              <div className="detail-view">
                <h3>구매 내역</h3>
                <div className="form-grid">
                  <div className="field"><label>구매자(수취인)</label><p>{currentReview?.name}</p></div>
                  <div className="field"><label>전화번호</label><p>{currentReview?.phoneNumber}</p></div>
                </div>
                {[{ key: 'orderNumber', label: '주문번호' }, { key: 'participantId', label: '상품명'}, { key: 'address', label: '주소' }, { key: 'bankNumber', label: '계좌번호' }, { key: 'accountHolderName', label: '예금주' }, { key: 'rewardAmount', label: '금액' }].map(({ key, label }) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    {isEditing ? <input name={key} value={editableData[key] || ''} onChange={handleDataChange} /> : <p>{currentReview?.[key]}</p>}
                  </div>
                ))}
                <div className="field"><label>은행</label>{isEditing ? (<select name="bank" value={editableData.bank || ''} onChange={handleDataChange}><option value="">은행 선택</option>{bankOptions.map(b => <option key={b} value={b}>{b}</option>)}</select>) : (<p>{currentReview?.bank}</p>)}</div>
                {[{ key: 'likeImageUrl', label: '상품 찜' }, { key: 'orderImageUrl', label: '구매 인증' }, { key: 'cashcardImageUrl', label: '현영/매출전표' }, { key: 'keywordImageUrl', label: '키워드 인증' }].map(({ key, label }) => currentReview?.[key] ? (<div className="field" key={key}><label>{label}</label><img src={currentReview[key]} alt={label} className="thumb" /></div>) : null)}
                <div className="modal-actions">{isEditing ? (<><button onClick={handleSave} disabled={uploading}>{uploading ? '저장 중...' : '저장'}</button><button onClick={handleCancelEdit} className="secondary">취소</button></>) : (<><button onClick={handleEdit}>수정</button><button onClick={closeModal} className="secondary">닫기</button></>)}</div>
              </div>
            )}
            {modalType === 'upload' && (<><h3>리뷰 인증 이미지 업로드</h3><input type="file" accept="image/*" multiple onChange={onFile} /><button onClick={uploadConfirm} disabled={uploading || files.length === 0} style={{ marginTop: 16 }}>{uploading ? '업로드 중…' : '완료'}</button></>)}
          </div>
        </div>
      )}
    </div>
  );
}
