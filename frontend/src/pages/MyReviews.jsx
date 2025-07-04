// D:\hellopiggy\frontend\src\pages\MyReviews.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
} from '../firebaseConfig';
import { createMainAccountId } from '../utils';
import './MyReviews.css';

// 상태(status)에 따른 텍스트와 클래스를 반환하는 헬퍼 함수
const getStatusInfo = (review) => {
  const { status, confirmImageUrls, rejectionReason } = review;

  switch (status) {
    case 'review_completed':
      return { text: '리뷰 완료', className: 'review-completed' };
    case 'verified':
      return { text: '리뷰 인증 완료', className: 'verified' };
    case 'rejected':
      return { text: `리뷰 반려됨`, className: 'rejected', reason: rejectionReason };
    case 'settled':
      return { text: '정산 완료', className: 'settled' };
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
  const [modal, setModal] = useState(null); 
  const [cur, setCur] = useState(null); 
  
  // ▼▼▼ 누락되었던 상태들 복원 ▼▼▼
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState({});
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const name = localStorage.getItem('REVIEWER_NAME');
    const phone = localStorage.getItem('REVIEWER_PHONE');
    if (!name || !phone) return nav('/reviewer-login', { replace: true });

    const fetchAllReviews = async () => {
      try {
        const mainAccountId = createMainAccountId(name, phone);
        const q = query(
          collection(db, 'reviews'),
          where('mainAccountId', '==', mainAccountId),
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
    };
    fetchAllReviews();
  }, [nav]);

  const open = (type, r) => {
    setCur(r);
    setModal(type);
    setIsEditing(false); // 모달 열 때 항상 보기 모드로 초기화
  };

  const close = () => {
    setModal(null);
    setFiles([]);
    setUploading(false);
    setIsEditing(false);
  };

  // ▼▼▼ 누락되었던 핸들러 함수들 복원 ▼▼▼
  const handleEdit = () => {
    setEditableData({ ...cur });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleDataChange = (e) => {
    setEditableData({ ...editableData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!cur) return;
    setUploading(true);
    try {
      await updateDoc(doc(db, 'reviews', cur.id), editableData);
      
      setRows(rows.map(row => row.id === cur.id ? { ...row, ...editableData } : row));
      setCur({ ...cur, ...editableData });

      alert('수정이 완료되었습니다.');
      setIsEditing(false);
    } catch (e) {
      alert('수정 실패: ' + e.message);
    } finally {
      setUploading(false);
    }
  };
  
  // ▼▼▼ 여기가 문제의 원인! onFile 함수를 다시 정의합니다. ▼▼▼
  const onFile = (e) => {
    setFiles(Array.from(e.target.files || []));
  };
  
  const uploadConfirm = async () => {
    if (!cur || files.length === 0) return alert('파일을 선택하세요');
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
        status: 'review_completed' 
      };
      await updateDoc(doc(db, 'reviews', cur.id), updatedData);

      setRows(rows.map(row => 
        row.id === cur.id ? { ...row, ...updatedData } : row
      ));

      alert('리뷰 인증이 완료되었습니다.');
      close();
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
      <button className="logout" onClick={() => { localStorage.clear(); nav('/reviewer-login', { replace: true }); }}>
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
              <button onClick={() => open('guide', r)}>진행 가이드</button>
              <button onClick={() => open('detail', r)}>구매 내역</button>
              <button className="outline" onClick={() => open('upload', r)} disabled={r.status === 'settled' || r.status === 'rejected'}>
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
      
      {modal && (
        <div className="modal-back" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={close}>✖</button>
            
            {modal === 'guide' && (
              <><h3>진행 가이드</h3><p style={{ whiteSpace: 'pre-line' }}>{cur?.content || '준비 중입니다.'}</p></>
            )}

            {modal === 'detail' && (
              <div className="detail-view">
                <h3>구매 내역</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>구매자(수취인)</label>
                    <p>{cur?.name}</p>
                  </div>
                  <div className="field">
                    <label>전화번호</label>
                    <p>{cur?.phoneNumber}</p>
                  </div>
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
                      <p>{cur?.[key]}</p>
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
                    <p>{cur?.bank}</p>
                  )}
                </div>

                {[
                  { key: 'likeImageUrl', label: '상품 찜' },
                  { key: 'orderImageUrl', label: '구매 인증' },
                  { key: 'cashcardImageUrl', label: '현영/매출전표' },
                  { key: 'keywordImageUrl', label: '키워드 인증' },
                ].map(({ key, label }) =>
                  cur?.[key] ? (
                    <div className="field" key={key}>
                      <label>{label}</label>
                      <img src={cur[key]} alt={label} className="thumb" />
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
                      <button onClick={close} className="secondary">닫기</button>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {modal === 'upload' && (
              <>
                <h3>리뷰 인증 이미지 업로드</h3>
                {/* ▼▼▼ 여기 onChange에 onFile 함수를 연결합니다. ▼▼▼ */}
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