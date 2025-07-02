// src/pages/AdminReviewManagement.jsx

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc } from '../firebaseConfig';
import Papa from 'papaparse';

export default function AdminReviewManagement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchReviews = async () => {
      setLoading(true);
      const snap = await getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc')));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchReviews();
  }, []);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [
        r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : '',
        r.productName,
        r.name,
        r.phoneNumber,
        r.title,
      ]
        .join(' ')
        .toLowerCase()
        .includes(s)
    );
  }, [rows, search]);

  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) {
      setSelected(new Set(filteredRows.map((r) => r.id)));
    } else {
      setSelected(new Set());
    }
  };

  const markVerified = async () => {
    if (selected.size === 0) return;
    for (const id of selected) {
      await updateDoc(doc(db, 'reviews', id), { verified: true });
    }
    setRows(rows.map((r) => (selected.has(r.id) ? { ...r, verified: true } : r)));
    setSelected(new Set());
  };

  const downloadCsv = () => {
    const csvData = filteredRows.map((r, i) => ({
      순번: i + 1,
      등록일시: r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : '',
      리뷰제목: r.title,
      상품명: r.productName || '-',
      이름: r.name,
      전화번호: r.phoneNumber,
      인증: r.verified ? 'O' : 'X',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p>리뷰 정보를 불러오는 중...</p>;

  return (
    <>
      <h2>리뷰 관리 ({filteredRows.length})</h2>
      <div className="toolbar">
        <button onClick={markVerified} disabled={selected.size === 0}>
          선택 항목 리뷰 인증
        </button>
        <input placeholder="검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={selected.size === filteredRows.length && filteredRows.length > 0}
                onChange={toggleSelectAll}
              />
            </th>
            <th>순번</th>
            <th>등록일시</th>
            <th>리뷰 제목</th>
            <th>상품명</th>
            <th>이름</th>
            <th>전화번호</th>
            <th>인증</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r, idx) => (
            <tr key={r.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                />
              </td>
              <td>{idx + 1}</td>
              <td>{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : ''}</td>
              <td>{r.title}</td>
              <td>{r.productName || '-'}</td>
              <td>{r.name}</td>
              <td>{r.phoneNumber}</td>
              <td>{r.verified ? 'O' : 'X'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}