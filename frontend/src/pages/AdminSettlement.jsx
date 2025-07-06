// D:\hellopiggy\frontend\src\pages\AdminSettlement.jsx (단순화된 최종 버전)

import { useEffect, useState } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc, getDoc } from '../firebaseConfig';
import Papa from 'papaparse'; // CSV 생성을 위해 import

export default function AdminSettlement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());

  const fetchSettlementList = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', '==', 'verified'), orderBy('verifiedAt', 'desc'));
    const snap = await getDocs(q);

    const settlementData = await Promise.all(snap.docs.map(async (d) => {
      const review = { id: d.id, ...d.data() };
      
      // subAccountId를 통해 이체에 필요한 모든 정보(은행명, 계좌번호 등)를 가져옵니다.
      if (review.subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
        const subAccountSnap = await getDoc(subAccountRef);
        if (subAccountSnap.exists()) {
          // subAccounts 문서의 데이터를 review 객체에 병합합니다.
          const subAccountData = subAccountSnap.data();
          Object.assign(review, subAccountData);
          review.subAccountName = subAccountData.name;

          if (subAccountData.mainAccountId) {
            const mainAccountRef = doc(db, 'users', subAccountData.mainAccountId);
            const mainAccountSnap = await getDoc(mainAccountRef);
            if (mainAccountSnap.exists()) {
              review.mainAccountName = mainAccountSnap.data().name;
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
  // ▼▼▼ 대량이체 CSV 다운로드 함수 (단순화된 버전) ▼▼▼
  const downloadBulkTransferCsv = () => {
    if (selected.size === 0) {
      alert('다운로드할 항목을 먼저 선택해주세요.');
      return;
    }

    const selectedRows = rows.filter(r => selected.has(r.id));
    
    // 이미지의 형식에 맞춰 Firestore에서 가져온 데이터를 그대로 사용합니다.
    const csvData = selectedRows.map(r => ({
      'A열 (은행명)': r.bank || '', // 1. 은행명 (한글)
      'B열 (입금계좌번호)': r.bankNumber ? `${r.bankNumber.replace(/-/g, '')}` : '', // 2. 계좌번호 (하이픈 제거)
      'C열 (이체금액)': r.rewardAmount || '0', // 3. 금액
      'D열 (예금주성명)': r.accountHolderName || '', // 4. 예금주명
      'E열 (입금계좌메모)': `헬로피기`, // 5. 받는분 통장 표시 (요청대로 직접 입력)
      'F열 (출금계좌메모)': `리뷰정산`, // 6. 내 통장 표시 (요청대로 직접 입력)
    }));

    // CSV 파일에는 데이터만 포함 (헤더 없음)
    const dataOnly = csvData.map(row => Object.values(row));

    const csv = Papa.unparse(dataOnly, { header: false });

    // UTF-8 BOM을 추가하여 Excel에서 한글이 깨지지 않도록 함
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `대량이체파일_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p>정산 내역을 불러오는 중...</p>;

  return (
    <>
      <h2>정산 내역 ({rows.length})</h2>
      <div className="toolbar">
        <button onClick={handleDelete} disabled={selected.size === 0} style={{backgroundColor: '#e53935', color: 'white'}}>선택삭제</button>
        <button onClick={handleSettle} disabled={selected.size === 0}>정산완료</button>
        <button onClick={downloadBulkTransferCsv} disabled={selected.size === 0} style={{backgroundColor: '#007bff', color: 'white'}}>
          대량이체 파일 다운로드
        </button>
      </div>

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