import { useEffect, useState } from 'react';
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
} from '../firebaseConfig';
import './AdminReviewList.css';

export default function AdminReviewList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const q = query(
        collection(db, 'reviews'),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  if (loading) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div className="admin-wrap">
      <h2>리뷰 목록 ({rows.length})</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th><th>이름</th><th>전화</th><th>제목</th><th>작성일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id.slice(0,6)}…</td>
              <td>{r.name}</td>
              <td>{r.phoneNumber}</td>
              <td>{r.title}</td>
              <td>{r.createdAt?.seconds
                     ? new Date(r.createdAt.seconds*1000).toLocaleString()
                     : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
