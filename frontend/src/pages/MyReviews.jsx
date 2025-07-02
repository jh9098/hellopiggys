import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from '../firebaseConfig';
import './MyReviews.css';

export default function MyReviews() {
  const [rows, setRows] = useState([]);
  const nav = useNavigate();

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
    })();
  }, [nav]);

  const logout = () => {
    localStorage.removeItem('REVIEWER_NAME');
    localStorage.removeItem('REVIEWER_PHONE');
    nav('/reviewer-login', { replace: true });
  };

  if (loading) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div className="my-wrap">
      <button className="logout" onClick={logout}>
        로그아웃 ➡
      </button>

      {rows.length === 0 && <p>등록한 리뷰가 없습니다.</p>}

      {rows.map((r) => (
        <div className="card" key={r.id}>
          <div className="card-head">
            <span className="badge">🟢현영🟢별리⭐</span>
            <span className="timestamp">
              {new Date(r.createdAt.seconds * 1000).toLocaleString()}
            </span>
          </div>

          <div className="btn-wrap">
            <button>진행 가이드</button>
            <button>구매 내역</button>
            <button className="outline">리뷰 인증하기</button>
          </div>

          <div className="product">{r.title}</div>
          <div className="status">구매 완료</div>
          <div className="price">{Number(r.rewardAmount || 0).toLocaleString()}원</div>
        </div>
      ))}
    </div>
  );
}
