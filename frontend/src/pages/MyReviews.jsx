// D:\hellopiggy\frontend\src\pages\MyReviews.jsx (수정된 최종 버전)

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
  deleteField
} from '../firebaseConfig';
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

  // ▼▼▼ 모달 관련 상태들을 복원하고 이름을 명확하게 변경합니다 ▼▼▼
  const [modalType, setModalType] = useState(null);       // 'guide', 'detail', 'upload' 등 모달의 종류
  const [currentReview, setCurrentReview] = useState(null); // 현재 선택된 리뷰 데이터
  
  const [isEditing, setIsEditing] = useState(false);      // 'detail' 모달의 수정 모드 여부
  const [editableData, setEditableData] = useState({});   // 수정 중인 데이터
  const [files, setFiles] = useState([]);                 // 'upload' 모달의 파일
  const [uploading, setUploading] = useState(false);      // 업로드/저장 진행 중 상태

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const q = query(
            collection(db, 'reviews'),
            where('mainAccountId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          const snap = await getDocs(q);
          setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (error) {
          console.error("리뷰를 불러오는 중 오류 발생:", error);
          alert('리뷰 정보를 가져오는 데 실패했습니다.');
        } finally {
          setLoading(false);
        }
      } else {
        nav('/reviewer-login', { replace: true });
      }
    });
    return () => unsubscribe();
  }, [nav]);

  const handleLogout = () => {
    auth.signOut();
    localStorage.clear();
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

  if (loading) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div className="my-wrap">
      <button className="logout" onClick={handleLogout}>
        로그아웃 ➡
      </button>

      {rows.map((r) => {
        const statusInfo = getStatusInfo(r);
        return (
          <div className={`card ${statusInfo.className}`} key={r.id}>
            <div className="card-head">
              <span className="badge">{statusInfo.text}</span>
              <span className="timestamp">
                {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}
              </span>
            </div>

            <div className="btn-wrap">
              <button onClick={() => openModal('guide', r)}>진행 가이드</button>
              <button onClick={() => openModal('detail', r)}>구매 내역</button>
              <button className="outline" onClick={() => openModal('upload', r)} disabled={r.status === 'settled' || r.status === 'verified'}>
                리뷰 인증하기
              </button>
            </div>
            
            <div className="product">{r.participantId || r.title || '제목 없음'}</div>

            {statusInfo.reason && (
              <div className="rejection-reason">
                <strong>반려 사유:</strong> {statusInfo.reason}
              </div>
            )}
            
            <div className="price">
              {Number(r.rewardAmount || 0).toLocaleString()}원
            </div>
          </div>
        );
      })}

      {/* ▼▼▼ 여기가 요청하신 모달 렌더링 부분입니다. (정상 작동하도록 수정) ▼▼▼ */}
      {modalType && (
        <div className="modal-back" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={closeModal}>✖</button>
            
            {modalType === 'guide' && (
              <>
                <h3>진행 가이드</h3>
                <p style={{ whiteSpace: 'pre-line' }}>
                  {currentReview?.content || '준비 중입니다.'}
                </p>
              </>
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
              <>
                <h3>리뷰 인증 이미지 업로드</h3>
                <input type="file" accept="image/*" multiple onChange={onFile} />
                <button onClick={uploadConfirm} disabled={uploading || files.length === 0} style={{ marginTop: 16 }}>
                  {uploading ? '업로드 중…' : '완료'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}