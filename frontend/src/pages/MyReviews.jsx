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
      // 'submitted' 또는 status가 없는 경우, 이미지 유무로 '리뷰 완료' 판단
      if (confirmImageUrls && confirmImageUrls.length > 0) {
        return { text: '리뷰 완료', className: 'review-completed' };
      }
      return { text: '구매 완료', className: 'submitted' };
  }
};

export default function MyReviews() {
  const nav = useNavigate();
  const storage = getStorageInstance();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null); 
  const [cur, setCur] = useState(null); 
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
  };
  const close = () => {
    setModal(null);
    setFiles([]);
    setUploading(false);
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
      
      // status를 'review_completed'로 변경
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
              <button className="outline" onClick={() => open('upload', r)} disabled={r.status === 'settled'}>
                리뷰 인증하기
              </button>
            </div>
            
            <div className="product">{r.participantId || r.title || '제목 없음'}</div>

            {/* 반려 사유가 있을 경우 표시 */}
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

            {/* 구매내역 모달 (새로운 디자인 적용) */}
            {modal === 'detail' && (
              <div className="detail-view">
                <h3>구매 내역</h3>
                <div className="form-grid">
                  {/* 이름과 전화번호 필드 */}
                  <div className="field">
                    <label>구매자(수취인)</label>
                    {isEditing ? (
                      // disabled 속성과 회색 배경 스타일 추가
                      <input 
                        name="name" 
                        value={editableData.name || ''} 
                        onChange={handleDataChange} 
                        disabled 
                        style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <p>{cur?.name}</p>
                    )}
                  </div>
                  <div className="field">
                    <label>전화번호</label>
                    {isEditing ? (
                      // disabled 속성과 회색 배경 스타일 추가
                      <input 
                        name="phoneNumber" 
                        value={editableData.phoneNumber || ''} 
                        onChange={handleDataChange} 
                        disabled
                        style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <p>{cur?.phoneNumber}</p>
                    )}
                  </div>
                </div>
                {/* 1열 필드 (이 부분은 변경 없음) */}
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
                      {['국민', '농협', '신한', '우리', '하나', '카카오뱅크'].map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (
                    <p>{cur?.bank}</p>
                  )}
                </div>

                {/* 이미지 섹션 및 하단 버튼 (이 부분도 변경 없음) */}
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
            
            {/* 리뷰 인증 업로드 모달 */}
            {modal === 'upload' && (
              <>
                <h3>리뷰 인증 이미지 업로드</h3>
                <input type="file" accept="image/*" multiple onChange={onFile} />
                <button onClick={uploadConfirm} disabled={uploading} style={{ marginTop: 16 }}>
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