import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc } from '../firebaseConfig';

export default function AdminSettlement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  const fetchSettlementList = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', '==', 'verified'), orderBy('verifiedAt', 'desc'));
    const snap = await getDocs(q);
    setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchSettlementList();
  }, []);

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
      setSelected(new Set(rows.map(r => r.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 삭제하시겠습니까?`)) return;
    for (const id of selected) {
      await deleteDoc(doc(db, 'reviews', id));
    }
    alert('삭제되었습니다.');
    setRows(rows.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  };

  const handleSettle = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 정산 완료 처리하시겠습니까?`)) return;
    for (const id of selected) {
      await updateDoc(doc(db, 'reviews', id), {
        status: 'settled',
        settledAt: serverTimestamp(),
      });
    }
    alert('정산 완료 처리되었습니다.');
    setRows(rows.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  };

  if (loading) return <p>정산 내역을 불러오는 중...</p>;

  return (
    <>
      <h2>정산 내역 ({rows.length})</h2>
      <div className="toolbar">
        <button onClick={handleDelete} disabled={selected.size === 0} style={{backgroundColor: '#e53935', color: 'white'}}>선택삭제</button>
        <button onClick={handleSettle} disabled={selected.size === 0}>정산완료</button>
        {/* 검색, 엑셀 다운로드 기능은 필요 시 추가 */}
      </div>
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())} /></th>
            <th>순번</th>
            <th>리뷰인증</th>
            <th>리뷰 제목</th>
            <th>상품명</th>
            <th>이미지</th>
            <th>전체/리뷰</th>
            <th>이름</th>
            <th>전화번호</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td>{idx + 1}</td>
              <td>{r.verifiedAt?.seconds ? new Date(r.verifiedAt.seconds * 1000).toLocaleString() : ''}</td>
              <td>{r.title}</td>
              <td>{r.productName || '-'}</td>
              <td>{r.confirmImageUrls && r.confirmImageUrls.length > 0 ? '✓' : '✗'}</td>
              <td>0/0</td> {/* 이 부분 로직은 추후 구체화 필요 */}
              <td>{r.name}</td>
              <td>{r.phoneNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}