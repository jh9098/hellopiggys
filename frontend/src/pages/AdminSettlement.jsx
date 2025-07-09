// src/pages/AdminSettlement.jsx (CSV 다운로드 기능 수정)

import { useEffect, useState } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc, getDoc } from '../firebaseConfig';
import Papa from 'papaparse';

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
      
      // 1. 상품 정보 가져오기
      if (review.productId) {
          const productRef = doc(db, 'products', review.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
              review.productInfo = productSnap.data();
          }
      }
      
      // 2. 타계정 정보(subAccounts) 가져오기
      if (review.subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
        const subAccountSnap = await getDoc(subAccountRef);
        if (subAccountSnap.exists()) {
          const subAccountData = subAccountSnap.data();
          Object.assign(review, subAccountData); // 주소, 은행, 계좌 등 모든 정보를 review 객체에 병합
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
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelected(new Set(rows.map(r => r.id)));
    else setSelected(new Set());
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

  // ▼▼▼ CSV 다운로드 함수 수정 ▼▼▼
  const downloadCsvForInfo = () => {
    if (rows.length === 0) {
      alert('다운로드할 정산 내역이 없습니다.');
      return;
    }

    // 요청하신 컬럼명으로 CSV 데이터를 생성합니다.
    const csvData = rows.map(r => ({
      '상품명': r.productInfo?.productName || r.productName || '-',
      '진행일자': r.productInfo?.reviewDate || '-',
      '주문번호': r.orderNumber || '-',
      '이름(참여자이름)': r.name || '-', // subAccount의 name
      '전화번호': r.phoneNumber || '-',
      '주소': r.address || '-',
      '은행': r.bank || '-',
      '계좌번호': `'${r.bankNumber || ''}`, // 엑셀에서 숫자 형식으로 변환 방지
      '예금주': r.accountHolderName || '-',
      '금액': r.rewardAmount || '0', // 금액도 추가하면 유용할 수 있습니다.
    }));

    // Papa.unparse는 객체 배열을 바로 CSV 문자열로 변환할 수 있습니다.
    // headers: true 옵션을 주면 객체의 key가 첫 줄(헤더)로 자동 추가됩니다.
    const csv = Papa.unparse(csvData, { header: true });

    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정산정보파일_${new Date().toISOString().slice(0, 10)}.csv`;
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
        {/* CSV 다운로드 버튼의 함수를 교체합니다. */}
        <button onClick={downloadCsvForInfo} disabled={rows.length === 0} style={{backgroundColor: '#007bff', color: 'white'}}>
          정보 파일 다운로드
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th><input type="checkbox" onChange={toggleSelectAll} checked={selected.size === rows.length && rows.length > 0} /></th>
            <th>리뷰 인증일</th>
            <th>상품명</th>
            <th>참여자 이름</th>
            <th>전화번호</th>
            <th>주문번호</th>
            <th>정산 금액</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td>{r.verifiedAt?.seconds ? new Date(r.verifiedAt.seconds * 1000).toLocaleString() : ''}</td>
              <td>{r.productInfo?.productName || r.productName || '-'}</td>
              <td>{r.name || '-'}</td>
              <td>{r.phoneNumber || '-'}</td>
              <td>{r.orderNumber || '-'}</td>
              <td>{r.rewardAmount ? Number(r.rewardAmount).toLocaleString() + '원' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}