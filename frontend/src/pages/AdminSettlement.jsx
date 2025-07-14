// src/pages/AdminSettlement.jsx (수정 완료)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc, getDoc } from '../firebaseConfig';
import ReviewDetailModal from '../components/ReviewDetailModal';
import Papa from 'papaparse';

const initialFilters = {
  productName: '', orderNumber: '', mainAccountName: '', subAccountName: '', phoneNumber: '', reviewConfirm: 'all',
};

export default function AdminSettlementPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'verifiedAt', direction: 'desc' });

  const fetchSettlementList = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', '==', 'verified'), orderBy('verifiedAt', 'desc'));
    const snap = await getDocs(q);
    const settlementData = await Promise.all(snap.docs.map(async (d) => {
      const review = { id: d.id, ...d.data() };
      if (review.productId) {
        const productRef = doc(db, 'products', review.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) review.productInfo = productSnap.data();
      }
      if (review.mainAccountId) {
        const userDocRef = doc(db, 'users', review.mainAccountId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) review.mainAccountName = userDocSnap.data().name;
      }
      if (review.subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
        const subAccountSnap = await getDoc(subAccountRef);
        if (subAccountSnap.exists()) {
          const subAccountData = subAccountSnap.data();
          // [수정] subAccount의 createdAt이 review의 createdAt을 덮어쓰지 않도록 합니다.
          delete subAccountData.createdAt;
          Object.assign(review, subAccountData); 
          review.subAccountName = subAccountData.name;
        }
      }
      return review;
    }));
    setRows(settlementData);
    setLoading(false);
  };

  useEffect(() => { fetchSettlementList(); }, []);

  const processedRows = useMemo(() => {
    let filtered = [...rows];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(row => {
        const targetValue = key === 'productName' ? (row.productInfo?.productName || row.productName) : row[key];
        if (key === 'reviewConfirm') {
          const hasImages = row.confirmImageUrls && row.confirmImageUrls.length > 0;
          return value === 'O' ? hasImages : !hasImages;
        }
        return targetValue?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let valA = a[sortConfig.key], valB = b[sortConfig.key];
        if (sortConfig.key === 'productName') {
            valA = a.productInfo?.productName || a.productName;
            valB = b.productInfo?.productName || b.productName;
        }
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [rows, filters, sortConfig]);

  const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const requestSort = (key) => {
    let direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };
  const resetFilters = () => setFilters(initialFilters);
  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    newSelected.has(id) ? newSelected.delete(id) : newSelected.add(id);
    setSelected(newSelected);
  };
  const toggleSelectAll = (e) => setSelected(e.target.checked ? new Set(processedRows.map(r => r.id)) : new Set());
  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 삭제하시겠습니까?`)) return;
    await Promise.all(Array.from(selected).map(id => deleteDoc(doc(db, 'reviews', id))));
    alert('삭제되었습니다.');
    fetchSettlementList();
    setSelected(new Set());
  };
  const handleSettle = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 정산 완료 처리하시겠습니까?`)) return;
    await Promise.all(Array.from(selected).map(id => updateDoc(doc(db, 'reviews', id), { status: 'settled', settledAt: serverTimestamp() })));
    alert('정산 완료 처리되었습니다.');
    fetchSettlementList();
    setSelected(new Set());
  };
  const downloadCsvForInfo = () => {
    if (processedRows.length === 0) return alert('다운로드할 정산 내역이 없습니다.');
    const toText = (v, excelText = false) => `="${(v ?? '').toString()}"`;
    const csvData = processedRows.map(r => ({
      '상품명': toText(r.productInfo?.productName || r.productName || '-'), '진행일자': toText(r.productInfo?.reviewDate || '-'),
      '주문번호': toText(r.orderNumber || '-'), '본계정 이름': toText(r.mainAccountName || '-'), '타계정 이름(수취인)': toText(r.subAccountName || '-'),
      '전화번호': toText(r.phoneNumber || '-', true), '주소': toText(r.address || '-'), '은행': toText(r.bank || '-'),
      '계좌번호': toText(r.bankNumber || '', true), '예금주': toText(r.accountHolderName || '-'), '금액': toText(r.rewardAmount || '0'),
    }));
    const csv = Papa.unparse(csvData, { header: true });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `정산정보파일_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const openDetailModal = (review) => { setSelectedReview(review); setIsModalOpen(true); };
  const closeDetailModal = () => { setIsModalOpen(false); setSelectedReview(null); };

  if (loading) return <p>정산 내역을 불러오는 중...</p>;
  const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  return (
    <>
      <h2>정산 내역 ({processedRows.length})</h2>
      <div className="toolbar">
        <button onClick={handleDelete} disabled={selected.size === 0}>선택삭제</button>
        <button onClick={handleSettle} disabled={selected.size === 0}>정산완료</button>
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsvForInfo} disabled={processedRows.length === 0}>정보 파일 다운로드</button>
      </div>
      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" onChange={toggleSelectAll} checked={selected.size === processedRows.length && processedRows.length > 0} /></th>
              <th onClick={() => requestSort('verifiedAt')} className="sortable">리뷰 인증일<SortIndicator columnKey="verifiedAt" /></th>
              <th onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('mainAccountName')} className="sortable">본계정 이름<SortIndicator columnKey="mainAccountName" /></th>
              <th onClick={() => requestSort('subAccountName')} className="sortable">타계정 이름<SortIndicator columnKey="subAccountName" /></th>
              <th onClick={() => requestSort('phoneNumber')} className="sortable">전화번호<SortIndicator columnKey="phoneNumber" /></th>
              <th onClick={() => requestSort('paymentType')} className="sortable">결제유형<SortIndicator columnKey="paymentType" /></th>
              <th onClick={() => requestSort('productType')} className="sortable">상품종류<SortIndicator columnKey="productType" /></th>
              <th onClick={() => requestSort('reviewOption')} className="sortable">리뷰종류<SortIndicator columnKey="reviewOption" /></th>
              <th onClick={() => requestSort('orderNumber')} className="sortable">주문번호<SortIndicator columnKey="orderNumber" /></th>
              <th>리뷰 인증</th>
              <th onClick={() => requestSort('rewardAmount')} className="sortable">정산 금액<SortIndicator columnKey="rewardAmount" /></th>
            </tr>
            <tr className="filter-row">
              <th></th><th></th>
              <th><input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="mainAccountName" value={filters.mainAccountName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="subAccountName" value={filters.subAccountName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} /></th>
              <th></th><th></th><th></th>
              <th><input type="text" name="orderNumber" value={filters.orderNumber} onChange={handleFilterChange} /></th>
              <th><select name="reviewConfirm" value={filters.reviewConfirm} onChange={handleFilterChange}><option value="all">전체</option><option value="O">O</option><option value="X">X</option></select></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                <td>{r.verifiedAt?.seconds ? new Date(r.verifiedAt.seconds * 1000).toLocaleString() : ''}</td>
                <td>{r.productInfo?.productName || r.productName || '-'}</td>
                <td>{r.mainAccountName || '-'}</td>
                <td>{r.subAccountName || '-'}</td>
                <td>{r.phoneNumber || '-'}</td>
                <td>{r.paymentType || '-'}</td>
                <td>{r.productType || '-'}</td>
                <td>{r.reviewOption || '-'}</td>
                <td>{r.orderNumber || '-'}</td>
                <td><button className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>{r.confirmImageUrls?.length > 0 ? 'O' : 'X'}</button></td>
                <td>{r.rewardAmount ? Number(r.rewardAmount).toLocaleString() + '원' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />}
    </>
  );
}