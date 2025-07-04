// D:\hellopiggy\frontend\src\pages\AdminSettlement.jsx

import { useEffect, useState } from 'react';
// 1. getDoc을 import 목록에 추가합니다.
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc, getDoc } from '../firebaseConfig';

export default function AdminSettlement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  // 2. '리뷰 관리' 페이지의 데이터 조회 로직을 여기에 적용합니다.
  const fetchSettlementList = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', '==', 'verified'), orderBy('verifiedAt', 'desc'));
    const snap = await getDocs(q);

    // mainAccountName과 subAccountName을 가져오는 로직 추가
    const settlementData = await Promise.all(snap.docs.map(async (d) => {
      const review = { id: d.id, ...d.data() };
      if (review.subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
        const subAccountSnap = await getDoc(subAccountRef);
        if (subAccountSnap.exists()) {
          const subAccountData = subAccountSnap.data();
          review.subAccountName = subAccountData.name; // 타계정 이름
          if (subAccountData.mainAccountId) {
            const mainAccountRef = doc(db, 'mainAccounts', subAccountData.mainAccountId);
            const mainAccountSnap = await getDoc(mainAccountRef);
            if (mainAccountSnap.exists()) {
              review.mainAccountName = mainAccountSnap.data().name; // 본계정 이름
            }
          }
        }
      }
      return review;
    }));

    setRows(settlementData);
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
      </div>
      {/* 3. 테이블 구조를 '리뷰 관리'와 유사하게 수정합니다. */}
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" onChange={toggleSelectAll} checked={selected.size === rows.length && rows.length > 0} /></th>
            <th>순번</th>
            <th>등록일시</th>
            <th>리뷰 인증일</th>
            <th>리뷰 제목</th>
            <th>상품명</th>
            <th>본계정 이름</th>
            <th>타계정 이름</th>
            <th>전화번호</th>
            <th>리뷰 제출</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td>{idx + 1}</td>
              {/* 원본 등록일시 */}
              <td>{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</td>
              {/* 리뷰 인증 처리된 날짜 */}
              <td>{r.verifiedAt?.seconds ? new Date(r.verifiedAt.seconds * 1000).toLocaleString() : ''}</td>
              <td>{r.title}</td>
              {/* 상품명은 participantId를 사용했으므로 통일합니다. */}
              <td>{r.participantId || '-'}</td>
              {/* 새로 가져온 본계정/타계정 이름을 표시합니다. */}
              <td>{r.mainAccountName || '-'}</td>
              <td>{r.subAccountName || '-'}</td>
              <td>{r.phoneNumber}</td>
              {/* 리뷰 제출 여부를 'O' / 'X'로 통일합니다. */}
              <td>{r.confirmImageUrls && r.confirmImageUrls.length > 0 ? 'O' : 'X'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}