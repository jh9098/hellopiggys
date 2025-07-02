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
import './MyReviews.css';

export default function MyReviews() {
  const nav = useNavigate();
  const storage = getStorageInstance();

  /* ───── 데이터 및 상태 관리 ───── */
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [modal, setModal] = useState(null); // 'guide' | 'detail' | 'upload' | null
  const [cur, setCur] = useState(null); // 선택된 원본 리뷰 객체

  // 수정 모드 상태
  const [isEditing, setIsEditing] = useState(false);
  const [editableData, setEditableData] = useState({});

  // 리뷰 인증 업로드 상태
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  /* ───── 데이터 로딩 ───── */
  useEffect(() => {
    const name = localStorage.getItem('REVIEWER_NAME');
    const phone = localStorage.getItem('REVIEWER_PHONE');
    if (!name || !phone) return nav('/reviewer-login', { replace: true });

    (async () => {
      const q = query(
        collection(db, 'reviews'),
        where('name', '==', name),
        where('phoneNumber', '==', phone),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, [nav]);

  /* ───── 핸들러: 모달 및 수정 ───── */
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

  const handleEdit = () => {
    setEditableData({ ...cur }); // 현재 데이터를 수정용 상태에 복사
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
    setUploading(true); // 저장 중 상태로 변경
    try {
      await updateDoc(doc(db, 'reviews', cur.id), editableData);
      
      // 로컬 상태도 업데이트하여 새로고침 없이 변경사항 반영
      setRows(rows.map(row => row.id === cur.id ? { ...row, ...editableData } : row));

      alert('수정이 완료되었습니다.');
      setIsEditing(false); // 보기 모드로 전환
      setCur({ ...cur, ...editableData }); // 현재 보고 있는 데이터도 업데이트
    } catch (e) {
      alert('수정 실패: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  /* ───── 핸들러: 리뷰 인증 업로드 ───── */
  const onFile = (e) => setFiles(Array.from(e.target.files || []));
  const uploadConfirm = async () => {
    if (files.length === 0) return alert('파일을 선택하세요');
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const r = ref(storage, `confirmImages/${Date.now()}_${f.name}`);
        await uploadBytes(r, f);
        urls.push(await getDownloadURL(r));
      }
      const updatedData = { confirmImageUrls: urls, confirmedAt: new Date() };
      await updateDoc(doc(db, 'reviews', cur.id), updatedData);

      setRows(rows.map(row => row.id === cur.id ? { ...row, ...updatedData } : row));

      alert('업로드 완료');
      close();
    } catch (e) {
      alert('업로드 실패:' + e.message);
    } finally {
      setUploading(false);
      setFiles([]);
    }
  };

  /* ───────── 렌더링 ───────── */
  if (loading) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div className="my-wrap">
      <button
        className="logout"
        onClick={() => {
          localStorage.clear();
          nav('/reviewer-login', { replace: true });
        }}
      >
        로그아웃 ➡
      </button>

      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-head">
            <span className="badge">🟢현영🟢별리⭐</span>
            <span className="timestamp">
              {r.createdAt?.seconds
                ? new Date(r.createdAt.seconds * 1000).toLocaleString()
                : ''}
            </span>
          </div>

          <div className="btn-wrap">
            <button onClick={() => open('guide', r)}>진행 가이드</button>
            <button onClick={() => open('detail', r)}>구매 내역</button>
            <button className="outline" onClick={() => open('upload', r)}>
              리뷰 인증하기
            </button>
          </div>

          <div className="product">{r.title || '제목 없음'}</div>
          <div className="status">구매 완료</div>
          <div className="price">
            {Number(r.rewardAmount || 0).toLocaleString()}원
          </div>
        </div>
      ))}

      {/* ───── 모달 렌더링 ───── */}
      {modal && (
        <div className="modal-back" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={close}>✖</button>

            {/* 진행 가이드 모달 */}
            {modal === 'guide' && (
              <>
                <h3>진행 가이드</h3>
                <p style={{ whiteSpace: 'pre-line' }}>{cur?.content || '준비 중입니다.'}</p>
              </>
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
                  { key: 'detailAddress', label: '상세주소' },
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
                  { key: 'likeImageUrl', label: '상품 찜 캡처' },
                  { key: 'orderImageUrl', label: '구매 인증 캡처' },
                  { key: 'secondOrderImageUrl', label: '추가 구매 인증' },
                  { key: 'reviewImageUrl', label: '리뷰 인증 캡처' },
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