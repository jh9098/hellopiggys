import { useEffect, useState, useMemo } from 'react';
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
} from '../firebaseConfig';
import './AdminReviewMgmt.css';
import Papa from 'papaparse';

export default function AdminReviewManagement() {
  /* 데이터 · 상태 */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  /* 로드 */
  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, 'reviews'), orderBy('createdAt', 'desc'))
      );
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    })();
  }, []);

  /* 필터링 */
  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [
        r.createdAt?.seconds
          ? new Date(r.createdAt.seconds*1000).toLocaleString()
          : '',
        r.productName,
        r.name,
        r.phoneNumber,
      ]
        .join(' ')
        .toLowerCase()
        .includes(s)
    );
  }, [rows, search]);

  /* 체크박스 */
  const toggle = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  /* 리뷰 인증 처리 */
  const markVerified = async () => {
    for (const id of selected) {
      await updateDoc(doc(db, 'reviews', id), { verified: true });
    }
    setRows(rows.map((r) => (selected.has(r.id) ? { ...r, verified: true } : r)));
    setSelected(new Set());
  };

  /* CSV 다운로드 */
  const downloadCsv = () => {
    const csv = Papa.unparse(
      rows.map((r, i) => ({
        seq: i + 1,
        ...r,
        createdAt: r.createdAt?.seconds
          ? new Date(r.createdAt.seconds*1000).toLocaleString()
          : '',
      }))
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `reviews_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* 렌더 */
  if (loading) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div className="admin-layout">
      <aside>
        <h1>HELLO PIGGY</h1>
        <nav>
          <a className="active">리뷰관리 ●</a>
        </nav>
      </aside>

      <main>
        <h2>리뷰 관리</h2>

        <div className="toolbar">
          <button onClick={markVerified} disabled={!selected.size}>
            리뷰 인증
          </button>
          <input
            placeholder="검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={downloadCsv}>엑셀 다운로드</button>
        </div>

        <table>
          <thead>
            <tr>
              <th><input
                type="checkbox"
                checked={selected.size === filtered.length && filtered.length}
                onChange={(e) =>
                  setSelected(
                    e.target.checked ? new Set(filtered.map((r) => r.id)) : new Set()
                  )
                }
              /></th>
              <th>순번</th>
              <th>등록일시</th>
              <th>리뷰 제목</th>
              <th>상품명</th>
              <th>이미지</th>
              <th>전체/리뷰</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>인증</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td>{idx + 1}</td>
                <td>
                  {r.createdAt?.seconds
                    ? new Date(r.createdAt.seconds * 1000).toLocaleString()
                    : ''}
                </td>
                <td>{r.title}</td>
                <td>{r.productName || '-'}</td>
                <td>{r.confirmImageUrls?.length ? '✓' : '✕'}</td>
                <td>0/0</td>
                <td>{r.name}</td>
                <td>{r.phoneNumber}</td>
                <td>{r.verified ? 'O' : 'X'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
