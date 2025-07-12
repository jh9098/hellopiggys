// src/pages/AdminSettlementComplete.jsx (Tailwind CSS 제거 최종본)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc } from '../firebaseConfig';
import ReviewDetailModal from '../components/ReviewDetailModal';

export default function AdminSettlementCompletePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const initialFilters = { productName: '', orderNumber: '', mainAccountName: '', subAccountName: '', phoneNumber: '', reviewConfirm: 'all' };
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'settledAt', direction: 'desc' });
  
  const fetchSettledList = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', '==', 'settled'), orderBy('settledAt', 'desc'));
    const snap = await getDocs(q);
    const data = await Promise.all(snap.docs.map(async (d) => {
        const review = { id: d.id, ...d.data() };
        if (review.productId) {
          const productRef = doc(db, 'products', review.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) review.productInfo = productSnap.data();
        }
        if (review.mainAccountId) {
          const userRef = doc(db, 'users', review.mainAccountId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) review.mainAccountName = userSnap.data().name;
        }
        if (review.subAccountId) {
          const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
          const subAccountSnap = await getDoc(subAccountRef);
          if (subAccountSnap.exists()) {
            const subAccountData = subAccountSnap.data();
            Object.assign(review, subAccountData);
            review.subAccountName = subAccountData.name;
          }
        }
        return review;
      }));
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { fetchSettledList(); }, []);

  const handleFilterChange = (e) => setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const requestSort = (key) => {
    let direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };
  const resetFilters = () => setFilters(initialFilters);

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

  const openDetailModal = (review) => { setSelectedReview(review); setIsModalOpen(true); };
  const closeDetailModal = () => { setIsModalOpen(false); setSelectedReview(null); };
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
    fetchSettledList();
    setSelected(new Set());
  };

  if (loading) return <p>정산 완료 목록을 불러오는 중...</p>;
  const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  return (
    <>
      <h2>정산 완료 ({processedRows.length})</h2>
      <div className="toolbar">
        <button onClick={handleDelete} disabled={selected.size === 0}>선택삭제</button>
        <button onClick={resetFilters}>필터 초기화</button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" onChange={toggleSelectAll} checked={selected.size === processedRows.length && processedRows.length > 0} /></th>
              <th onClick={() => requestSort('settledAt')} className="sortable">정산완료일<SortIndicator columnKey="settledAt" /></th>
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
              <th></th><th></th><th></th>
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
                <td>{r.settledAt?.seconds ? new Date(r.settledAt.seconds * 1000).toLocaleString() : ''}</td>
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