// D:\hellopiggy\frontend\src\pages\MyReviews.jsx (수정된 최종 버전)

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Link 추가
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
  getDoc // getDoc 추가
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal'; // 로그인 모달 추가
import './MyReviews.css';

// 상태(status)에 따른 텍스트와 클래스를 반환하는 헬퍼 함수
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

  // 1. 로그인 모달 상태 추가
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // 로그인된 사용자가 있으면
        setIsLoginModalOpen(false); // 혹시 열려있을 수 있는 로그인 모달 닫기
        try {
          const q = query(
            collection(db, 'reviews'),
            where('mainAccountId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          const snap = await getDocs(q);
          
          // 각 리뷰에 연결된 subAccount 정보를 가져와서 병합
          const reviewsWithDetails = await Promise.all(snap.docs.map(async (d) => {
            const reviewData = { id: d.id, ...d.data() };
            if (reviewData.subAccountId) {
              const subDocRef = doc(db, 'subAccounts', reviewData.subAccountId);
              const subDocSnap = await getDoc(subDocRef);
              if (subDocSnap.exists()) {
                // subAccount의 데이터를 review 데이터에 덮어쓰지 않고, 별도 객체로 관리하거나 필요한 필드만 추가
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
        // 2. 로그인되지 않은 경우, 페이지 이동 대신 로그인 모달을 열도록 유도
        setLoading(false); // 로딩 종료
        setIsLoginModalOpen(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    auth.signOut();
    localStorage.clear();
    nav('/reviewer-login'); // 로그아웃 후 로그인 페이지로 이동
  };

  // ▼▼▼ 모달 열기/닫기 함수 (원래 코드의 open/close) ▼▼▼
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

  // ▼▼▼ 수정 관련 핸들러들 (원래 코드와 동일한 로직) ▼▼▼
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

  const handleSave = async () => {
    if (!currentReview) return;
    setUploading(true);
    try {
      await updateDoc(doc(db, 'reviews', currentReview.id), editableData);
      
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
  
  // ▼▼▼ 파일 업로드 핸들러들 (원래 코드와 동일한 로직) ▼▼▼
  const onFile = (e) => {
    setFiles(Array.from(e.target.files || []));
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
          const newRow = { ...row, ...updatedData };
          delete newRow.rejectionReason;
          return newRow;
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
  // 3. 로그인 성공 시 모달을 닫기만 함 (페이지는 자동으로 새로고침됨)
  const handleLoginSuccess = () => {
    setIsLoginModalOpen(false);
    // onAuthStateChanged가 로그인 상태를 감지하고 데이터를 다시 불러올 것임
  };

  if (loading) {
    return <p style={{ padding: 24, textAlign: 'center' }}>데이터를 불러오는 중...</p>;
  }
  
  if (!currentUser) {
    return (
      <div className="my-wrap" style={{ textAlign: 'center', paddingTop: '50px' }}>
        <h2>내 리뷰 목록</h2>
        <p>리뷰를 확인하려면 로그인이 필요합니다.</p>
        <button onClick={() => setIsLoginModalOpen(true)}>로그인 / 회원가입</button>
        {isLoginModalOpen && (
          <LoginModal 
            onClose={() => setIsLoginModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
          />
        )}
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
            <div className="card-head">
              <span className="badge">{statusInfo.text}</span>
              <span className="timestamp">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</span>
            </div>
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
            {modalType === 'guide' && (
              <><h3>진행 가이드</h3><p style={{ whiteSpace: 'pre-line' }}>{currentReview?.content || '준비 중입니다.'}</p></>
            )}

            {modalType === 'detail' && (
              <div className="detail-view">
                <h3>구매 내역</h3>
                <div className="form-grid">
                  <div className="field"><label>구매자(수취인)</label><p>{currentReview?.name}</p></div>
                  <div className="field"><label>전화번호</label><p>{currentReview?.phoneNumber}</p></div>
                </div>
                {[
                  { key: 'orderNumber', label: '주문번호' },
                  { key: 'address', label: '주소' },
                  { key: 'bankNumber', label: '계좌번호' },
                  { key: 'accountHolderName', label: '예금주' },
                  { key: 'rewardAmount', label: '금액' },
                ].map(({ key, label }) => (
                  <div className="field" key={key}>
                    <label>{label}</label>
                    {isEditing ? (
                      <input name={key} value={editableData[key] || ''} onChange={handleDataChange} />
                    ) : (
                      <p>{currentReview?.[key]}</p>
                    )}
                  </div>
                ))}
                <div className="field">
                  <label>은행</label>
                  {isEditing ? (
                    <select name="bank" value={editableData.bank || ''} onChange={handleDataChange}>
                      <option value="">은행 선택</option>
                      {bankOptions.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (
                    <p>{currentReview?.bank}</p>
                  )}
                </div>
                {[
                  { key: 'likeImageUrl', label: '상품 찜' },
                  { key: 'orderImageUrl', label: '구매 인증' },
                  { key: 'cashcardImageUrl', label: '현영/매출전표' },
                  { key: 'keywordImageUrl', label: '키워드 인증' },
                ].map(({ key, label }) =>
                  currentReview?.[key] ? (
                    <div className="field" key={key}>
                      <label>{label}</label>
                      <img src={currentReview[key]} alt={label} className="thumb" />
                    </div>
                  ) : null
                )}
                <div className="modal-actions">
                  {isEditing ? (
                    <>
                      <button onClick={handleSave} disabled={uploading}>
                        {uploading ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={handleCancelEdit} className="secondary">취소</button>
                    </>
                  ) : (
                    <>
                      <button onClick={handleEdit}>수정</button>
                      <button onClick={closeModal} className="secondary">닫기</button>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {modalType === 'upload' && (
              <><h3>리뷰 인증 이미지 업로드</h3><input type="file" accept="image/*" multiple onChange={onFile} /><button onClick={uploadConfirm} disabled={uploading || files.length === 0} style={{ marginTop: 16 }}>{uploading ? '업로드 중…' : '완료'}</button></>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
