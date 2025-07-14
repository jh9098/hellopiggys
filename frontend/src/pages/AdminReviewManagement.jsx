// src/pages/AdminReviewManagement.jsx (24시간 표기 수정)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, getDoc, deleteDoc } from '../firebaseConfig';
import Papa from 'papaparse';
import ReviewDetailModal from '../components/ReviewDetailModal';

// [추가] 24시간제 날짜 포맷 함수
const formatTimestamp24h = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  return new Date(timestamp.seconds * 1000).toLocaleString('ko-KR', { hour12: false });
};

const statusMap = { submitted: '구매 완료', review_completed: '리뷰 완료', rejected: '반려됨' };
const getStatusKeyByValue = (value) => Object.keys(statusMap).find(key => statusMap[key] === value);
const initialFilters = { productName: '', payType: '', mainAccountName: '', name: '', phoneNumber: '', status: 'all', reviewConfirm: 'all' };

export default function AdminReviewManagementPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const fetchReviews = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', 'in', ['submitted', 'review_completed', 'rejected', 'verified']), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const reviewsData = await Promise.all(snap.docs.map(async (d) => {
      const review = { id: d.id, ...d.data() };
      if (review.mainAccountId) {
        const userDocRef = doc(db, 'users', review.mainAccountId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) review.mainAccountName = userDocSnap.data().name; 
      }
      if (review.subAccountId) {
          const subAccountRef = doc(db, "subAccounts", review.subAccountId);
          const subAccountSnap = await getDoc(subAccountRef);
          if(subAccountSnap.exists()) {
            const subAccountData = subAccountSnap.data();
            delete subAccountData.createdAt; 
            Object.assign(review, subAccountData);
          }
      }
      return review;
    }));
    setRows(reviewsData.filter(r => r.status !== 'verified'));
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const processedRows = useMemo(() => {
    let filtered = [...rows];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(row => {
        if (key === 'status') return row.status === getStatusKeyByValue(value);
        if (key === 'reviewConfirm') {
          const hasImages = row.confirmImageUrls && row.confirmImageUrls.length > 0;
          return value === 'O' ? hasImages : !hasImages;
        }
        return row[key]?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
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

  const downloadCsv = () => {
    if (processedRows.length === 0) return alert("다운로드할 데이터가 없습니다.");
    const csvData = processedRows.map(r => ({
      // [수정] 다운로드 파일도 24시간제로 변경
      '구매폼 등록일시': formatTimestamp24h(r.createdAt), '상태': statusMap[r.status] || r.status, '상품명': r.productName, '결제 종류': r.reviewType,
      '본계정': r.mainAccountName, '타계정': r.name, '전화번호': r.phoneNumber, '주소': r.address, '쿠팡ID': r.participantId, '주문번호': r.orderNumber, '금액': r.rewardAmount,
      '결제유형': r.paymentType, '상품종류': r.productType, '리뷰종류': r.reviewOption, '은행': r.bank, '계좌번호': r.bankNumber, '예금주': r.accountHolderName,
      '리뷰인증': r.confirmImageUrls?.length > 0 ? 'O' : 'X', '반려사유': r.rejectionReason || ''
    }));
    const csvString = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    const today = new Date();
    link.download = `reviews_${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleVerify = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 리뷰 인증 처리하시겠습니까?`)) return;
    await Promise.all(Array.from(selected).map(id => updateDoc(doc(db, 'reviews', id), { status: 'verified', verifiedAt: serverTimestamp() })));
    alert('리뷰 인증이 완료되었습니다.');
    fetchReviews();
    setSelected(new Set());
  };
  
  const handleDelete = async () => {
    if (selected.size === 0) return alert('삭제할 항목을 선택해주세요.');
    if (!window.confirm(`선택된 ${selected.size}개의 리뷰 항목을 영구적으로 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(Array.from(selected).map(id => deleteDoc(doc(db, 'reviews', id))));
      alert(`${selected.size}개의 항목이 성공적으로 삭제되었습니다.`);
      fetchReviews();
      setSelected(new Set());
    } catch (error) {
      console.error("리뷰 삭제 실패:", error);
      alert('항목 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("반려 사유를 입력하세요:");
    if (reason === null || !reason.trim()) { if(reason !== null) alert("반려 사유를 반드시 입력해야 합니다."); return; }
    if (window.confirm(`이 리뷰를 반려 처리하시겠습니까?\n사유: ${reason}`)) {
      await updateDoc(doc(db, 'reviews', id), { status: 'rejected', rejectionReason: reason.trim(), rejectedAt: serverTimestamp() });
      alert('리뷰가 반려 처리되었습니다.');
      fetchReviews();
    }
  };

  const openDetailModal = (review) => { setSelectedReview(review); setIsModalOpen(true); };
  const closeDetailModal = () => { setIsModalOpen(false); setSelectedReview(null); };

  if (loading) return <p>리뷰 정보를 불러오는 중...</p>;
  const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  return (
    <>
      <h2>리뷰 관리 ({processedRows.length})</h2>
      <div className="toolbar">
        <button onClick={handleVerify} disabled={selected.size === 0}>선택 항목 리뷰 인증</button>
        <button onClick={handleDelete} disabled={selected.size === 0}>선택 항목 삭제</button>
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.size === processedRows.length && processedRows.length > 0} onChange={toggleSelectAll} /></th>
              <th onClick={() => requestSort('createdAt')} className="sortable">구매폼 등록일시<SortIndicator columnKey="createdAt" /></th>
              <th onClick={() => requestSort('status')} className="sortable">상태<SortIndicator columnKey="status" /></th>
              <th onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('payType')} className="sortable">결제 종류<SortIndicator columnKey="payType" /></th>
              <th onClick={() => requestSort('mainAccountName')} className="sortable">본계정<SortIndicator columnKey="mainAccountName" /></th>
              <th onClick={() => requestSort('name')} className="sortable">타계정<SortIndicator columnKey="name" /></th>
              <th onClick={() => requestSort('phoneNumber')} className="sortable">전화번호<SortIndicator columnKey="phoneNumber" /></th>
              <th onClick={() => requestSort('paymentType')} className="sortable">결제유형<SortIndicator columnKey="paymentType" /></th>
              <th onClick={() => requestSort('productType')} className="sortable">상품종류<SortIndicator columnKey="productType" /></th>
              <th onClick={() => requestSort('reviewOption')} className="sortable">리뷰종류<SortIndicator columnKey="reviewOption" /></th>
              <th>리뷰 인증</th>
              <th>작업</th>
            </tr>
            <tr className="filter-row">
              <th></th><th></th>
              <th><select name="status" value={filters.status} onChange={handleFilterChange}><option value="all">전체</option>{Object.values(statusMap).map(s => <option key={s} value={s}>{s}</option>)}</select></th>
              <th><input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="payType" value={filters.payType} onChange={handleFilterChange} /></th>
              <th><input type="text" name="mainAccountName" value={filters.mainAccountName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="name" value={filters.name} onChange={handleFilterChange} /></th>
              <th><input type="text" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} /></th>
              <th></th><th></th><th></th>
              <th><select name="reviewConfirm" value={filters.reviewConfirm} onChange={handleFilterChange}><option value="all">전체</option><option value="O">O</option><option value="X">X</option></select></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                {/* [수정] 헬퍼 함수 사용 */}
                <td>{formatTimestamp24h(r.createdAt)}</td>
                <td>{statusMap[r.status] || r.status}</td>
                <td className="product-name-cell">{r.productName || '-'}</td>
                <td>{r.payType || '-'}</td>
                <td>{r.mainAccountName || '-'}</td>
                <td>{r.name || '-'}</td>
                <td>{r.phoneNumber || '-'}</td>
                <td>{r.paymentType || '-'}</td>
                <td>{r.productType || '-'}</td>
                <td>{r.reviewOption || '-'}</td>
                <td><button className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>{r.confirmImageUrls?.length > 0 ? 'O' : 'X'}</button></td>
                <td><button onClick={() => handleReject(r.id)} className="reject-button">반려</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />}
    </>
  );
}