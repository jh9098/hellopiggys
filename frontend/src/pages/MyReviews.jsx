// src/pages/MyReviews.jsx (상품 정보 및 참여 계정 정보 표시 기능 추가)

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auth, onAuthStateChanged, db,
  collection, query, where, orderBy, getDocs, doc, getDoc,
  updateDoc, ref, uploadBytes, getDownloadURL, deleteField
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import './MyReviews.css';

// getStatusInfo 함수는 변경 없이 그대로 사용
const getStatusInfo = (review) => {
  const { status, confirmImageUrls, rejectionReason } = review;
  switch (status) {
    case 'review_completed': return { text: '리뷰 완료', className: 'review-completed' };
    case 'verified': return { text: '리뷰 인증 완료', className: 'verified' };
    case 'rejected': return { text: `리뷰 반려됨`, className: 'rejected', reason: rejectionReason };
    case 'settled': return { text: '정산 완료', className: 'settled' };
    case 'submitted':
    default:
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
        setLoading(true);
        try {
          const q = query(collection(db, 'reviews'), where('mainAccountId', '==', user.uid), orderBy('createdAt', 'desc'));
          const snap = await getDocs(q);
          
          // ▼▼▼ 데이터 가공 로직 수정 ▼▼▼
          const reviewsWithDetails = await Promise.all(snap.docs.map(async (d) => {
            const reviewData = { id: d.id, ...d.data() };

            // 1. 상품 정보(products 컬렉션) 가져오기
            if (reviewData.productId) {
              const productRef = doc(db, 'products', reviewData.productId);
              const productSnap = await getDoc(productRef);
              if (productSnap.exists()) {
                reviewData.productInfo = productSnap.data();
              }
            }

            // 2. 타계정 정보(subAccounts 컬렉션) 가져오기
            if (reviewData.subAccountId) {
              const subDocRef = doc(db, 'subAccounts', reviewData.subAccountId);
              const subDocSnap = await getDoc(subDocRef);
              if (subDocSnap.exists()) {
                // 상세 모달 및 카드 표시를 위해 필요한 정보들을 reviewData에 합칩니다.
                const subData = subDocSnap.data();
                reviewData.subAccountInfo = subData;
                reviewData.name = subData.name;
                reviewData.phoneNumber = subData.phoneNumber;
                reviewData.address = subData.address;
                reviewData.bank = subData.bank;
                reviewData.bankNumber = subData.bankNumber;
                reviewData.accountHolderName = subData.accountHolderName;
              }
            }
            
            // 3. 본계정 정보(users 컬렉션) 가져오기 (이름 비교용)
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                reviewData.mainAccountInfo = userSnap.data();
            }

            return reviewData;
          }));
          // ▲▲▲ 데이터 가공 로직 수정 ▲▲▲

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

  // 핸들러 함수들은 변경 없음
  const handleLogout = () => { auth.signOut(); };
  const handleLoginSuccess = () => { setIsLoginModalOpen(false); };
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
  const handleCancelEdit = () => setIsEditing(false);
  const handleDataChange = (e) => setEditableData({ ...editableData, [e.target.name]: e.target.value });
  const onFile = (e) => setFiles(Array.from(e.target.files || []));
  
  const handleSave = async () => {
    if (!currentReview) return;
    setUploading(true);
    try {
      if (currentReview.subAccountId) {
          const subAccountRef = doc(db, "subAccounts", currentReview.subAccountId);
          await updateDoc(subAccountRef, {
            name: editableData.name,
            phoneNumber: editableData.phoneNumber,
            address: editableData.address,
            bank: editableData.bank,
            bankNumber: editableData.bankNumber,
            accountHolderName: editableData.accountHolderName,
          });
      }
      
      const fieldsToUpdateInReview = {
        rewardAmount: editableData.rewardAmount,
        orderNumber: editableData.orderNumber,
        participantId: editableData.participantId
      };
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
      const updatedData = { 
        confirmImageUrls: urls, 
        confirmedAt: new Date(),
        status: 'review_completed',
        rejectionReason: deleteField() 
      };
      await updateDoc(doc(db, 'reviews', currentReview.id), updatedData);
      const updatedRows = rows.map(row => (row.id === currentReview.id) ? { ...row, ...updatedData } : row);
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
        // 참여 계정 이름 결정 (타계정 이름이 있으면 타계정, 없으면 본계정)
        const participantName = r.subAccountInfo?.name || r.mainAccountInfo?.name || '알 수 없음';
        // 참여 계정 유형
        const participantType = r.subAccountInfo ? `타계정(${participantName})` : '본계정';

        return (
          <div className={`card ${statusInfo.className}`} key={r.id}>
            {/* ▼▼▼ 리뷰 카드 헤더 수정 ▼▼▼ */}
            <div className="card-head">
              <div>
                <span className="badge">{statusInfo.text}</span>
                <span className="badge secondary">{participantType}</span>
              </div>
              <span className="timestamp">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</span>
            </div>
            
            {/* ▼▼▼ 상품 정보 섹션 추가 ▼▼▼ */}
            {r.productInfo && (
              <div className="product-details">
                <h4>{r.productInfo.productName}</h4>
                <p><strong>리뷰 종류:</strong> {r.productInfo.reviewType}</p>
                {r.productInfo.guide && (
                  <div className="guide-box">
                    <strong>가이드:</strong>
                    <p>{r.productInfo.guide}</p>
                  </div>
                )}
              </div>
            )}

            {statusInfo.reason && <div className="rejection-reason"><strong>반려 사유:</strong> {statusInfo.reason}</div>}

            <div className="price">{Number(r.rewardAmount || 0).toLocaleString()}원</div>
            
            {/* 버튼들은 하단으로 이동 */}
            <div className="btn-wrap">
              <button onClick={() => openModal('detail', r)}>제출 내역 상세</button>
              <button className="outline" onClick={() => openModal('upload', r)} disabled={r.status !== 'submitted' && r.status !== 'rejected'}>
                리뷰 인증하기
              </button>
            </div>
          </div>
        );
      })}
      
      {/* 모달 부분은 변경 없이 그대로 사용 */}
      {modalType && (
        <div className="modal-back" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={closeModal}>✖</button>
            {modalType === 'detail' && (
              <div className="detail-view">
                <h3>제출 내역 상세</h3>
                <div className="form-grid">
                  <div className="field"><label>구매자(수취인)</label><p>{currentReview?.name}</p></div>
                  <div className="field"><label>전화번호</label><p>{currentReview?.phoneNumber}</p></div>
                </div>
                {[{ key: 'orderNumber', label: '주문번호' }, { key: 'participantId', label: '참가자ID'}, { key: 'address', label: '주소' }, { key: 'bankNumber', label: '계좌번호' }, { key: 'accountHolderName', label: '예금주' }, { key: 'rewardAmount', label: '금액' }].map(({ key, label }) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    {isEditing ? <input name={key} value={editableData[key] || ''} onChange={handleDataChange} /> : <p>{currentReview?.[key]}</p>}
                  </div>
                ))}
                <div className="field"><label>은행</label>{isEditing ? (<select name="bank" value={editableData.bank || ''} onChange={handleDataChange}><option value="">은행 선택</option>{bankOptions.map(b => <option key={b} value={b}>{b}</option>)}</select>) : (<p>{currentReview?.bank}</p>)}</div>
                {[{ key: 'likeImageUrl', label: '상품 찜' }, { key: 'orderImageUrl', label: '구매 인증' }, { key: 'cashcardImageUrl', label: '현영/매출전표' }, { key: 'keywordImageUrl', label: '키워드 인증' }].map(({ key, label }) => currentReview?.[key] ? (<div className="field" key={key}><label>{label}</label><img src={currentReview[key]} alt={label} className="thumb" /></div>) : null)}
                {currentReview.confirmImageUrls && currentReview.confirmImageUrls.map((url, i) => (<div className="field" key={i}><label>리뷰 인증 {i+1}</label><img src={url} alt={`리뷰인증 ${i+1}`} className="thumb" /></div>))}
                <div className="modal-actions">{isEditing ? (<><button onClick={handleSave} disabled={uploading}>{uploading ? '저장 중...' : '저장'}</button><button onClick={handleCancelEdit} className="secondary">취소</button></>) : (<><button onClick={handleEdit} disabled={currentReview?.status === 'verified' || currentReview?.status === 'settled'}>수정</button><button onClick={closeModal} className="secondary">닫기</button></>)}</div>
              </div>
            )}
            {modalType === 'upload' && (<><h3>리뷰 인증 이미지 업로드</h3><input type="file" accept="image/*" multiple onChange={onFile} /><button onClick={uploadConfirm} disabled={uploading || files.length === 0} style={{ marginTop: 16 }}>{uploading ? '업로드 중…' : '완료'}</button></>)}
          </div>
        </div>
      )}
    </div>
  );
}