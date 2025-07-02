import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  storage,
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

  /* 리스트 로드 */
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);

  /* 모달 상태 */
  const [modal, setModal] = useState(null);     // 'guide' | 'detail' | 'upload' | null
  const [cur, setCur] = useState(null);         // 선택 리뷰 객체
  const [files, setFiles] = useState([]);       // 업로드 파일 리스트
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const name  = localStorage.getItem('REVIEWER_NAME');
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

  /* 버튼 핸들러 */
  const open = (type, r) => {
    setCur(r);
    setModal(type);
  };
  const close = () => {
    setModal(null); setFiles([]); setUploading(false);
  };

  /* 리뷰 인증 업로드 */
  const onFile = (e) => setFiles(Array.from(e.target.files || []));
  const uploadConfirm = async () => {
    if (files.length === 0) return alert('파일을 선택하세요');
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const rf = ref(storage, `confirmImages/${Date.now()}_${f.name}`);
        await uploadBytes(rf, f);
        urls.push(await getDownloadURL(rf));
      }
      await updateDoc(doc(db, 'reviews', cur.id), {
        confirmImageUrls: urls,
        confirmedAt: new Date(),
      });
      alert('업로드 완료!');
      close();
    } catch (err) {
      console.error(err);
      alert('업로드 실패: ' + err.message);
    }
  };

  /* ───────── 렌더 ───────── */
  if (loading) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div className="my-wrap">
      <button
        className="logout"
        onClick={() => { localStorage.clear(); nav('/reviewer-login', {replace:true}); }}
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

          <div className="product">{r.title}</div>
          <div className="status">구매 완료</div>
          <div className="price">
            {Number(r.rewardAmount || 0).toLocaleString()}원
          </div>
        </div>
      ))}

      {/* ───── 모달 공통 레이아웃 ───── */}
      {modal && (
        <div className="modal-back" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={close}>✖</button>

            {modal === 'guide' && (
              <>
                <h3>진행 가이드</h3>
                <p style={{ whiteSpace: 'pre-line' }}>
                  {cur?.content || '준비 중입니다.'}
                </p>
              </>
            )}

            {modal === 'detail' && (
              <>
                <h3>구매 내역</h3>
                <div className="detail-grid">
                  {Object.entries({
                    이름: cur?.name,
                    전화번호: cur?.phoneNumber,
                    참가자ID: cur?.participantId,
                    주문번호: cur?.orderNumber,
                    주소: `${cur?.address} ${cur?.detailAddress || ''}`,
                    은행: cur?.bank,
                    계좌번호: cur?.bankNumber,
                    예금주: cur?.accountHolderName,
                    금액: cur?.rewardAmount,
                  }).map(([k, v]) => (
                    <><span className="k">{k}</span><span>{v}</span></>
                  ))}
                </div>
              </>
            )}

            {modal === 'upload' && (
              <>
                <h3>리뷰 인증 이미지 업로드</h3>
                <input type="file" accept="image/*" multiple onChange={onFile} />
                <button
                  onClick={uploadConfirm}
                  disabled={uploading}
                  style={{ marginTop: 16 }}
                >
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
