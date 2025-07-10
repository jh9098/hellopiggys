// src/pages/AdminReviewManagement.jsx

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, getDoc, deleteDoc } from '../firebaseConfig';
import Papa from 'papaparse';
import ReviewDetailModal from '../components/ReviewDetailModal';

// 상태 텍스트와 DB 값 매핑
const statusMap = {
  submitted: '구매 완료',
  review_completed: '리뷰 완료',
  rejected: '반려됨',
};

const getStatusKeyByValue = (value) => {
  return Object.keys(statusMap).find(key => statusMap[key] === value);
};

// 필터 초기 상태
const initialFilters = {
  productName: '',
  reviewType: '',
  mainAccountName: '',
  name: '', // 타계정 이름
  phoneNumber: '',
  status: 'all', // 전체, 구매 완료, 리뷰 완료, 반려됨
  reviewConfirm: 'all', // 전체, O, X
};

export default function AdminReviewManagement() {
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
          if(subAccountSnap.exists()){
              const subData = subAccountSnap.data();
              Object.assign(review, subData);
          }
      }
      return review;
    }));
    
    setRows(reviewsData.filter(r => r.status !== 'verified'));
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const processedRows = useMemo(() => {
    let filtered = [...rows];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(row => {
        if (key === 'status') return row.status === getStatusKeyByValue(value);
        if (key === 'reviewConfirm') {
          const hasConfirmImages = row.confirmImageUrls && row.confirmImageUrls.length > 0;
          if (value === 'O') return hasConfirmImages;
          if (value === 'X') return !hasConfirmImages;
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
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };
  
  const resetFilters = () => setFilters(initialFilters);

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelected(new Set(processedRows.map((r) => r.id)));
    else setSelected(new Set());
  };

  // ▼▼▼ 엑셀 다운로드 함수 수정 ▼▼▼
  const downloadCsv = () => {
    if (processedRows.length === 0) {
      alert("다운로드할 데이터가 없습니다.");
      return;
    }

    // CSV로 만들 데이터 가공
    const csvData = processedRows.map(r => ({
      '등록일시': r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString('ko-KR') : '',
      '상태': statusMap[r.status] || r.status,
      '상품명': r.productName,
      '결제 종류': r.reviewType,
      '본계정': r.mainAccountName,
      '타계정': r.name,
      '전화번호': r.phoneNumber,
      '주소': r.address,
      '쿠팡ID': r.participantId,
      '주문번호': r.orderNumber,
      '금액': r.rewardAmount,
      '결제유형': r.paymentType,
      '상품종류': r.productType,
      '리뷰종류': r.reviewOption,
      '은행': r.bank,
      '계좌번호': r.bankNumber,
      '예금주': r.accountHolderName,
      '리뷰인증': r.confirmImageUrls?.length > 0 ? 'O' : 'X',
      '반려사유': r.rejectionReason || ''
    }));

    // Papa.unparse를 사용하여 JSON을 CSV 문자열로 변환
    const csvString = Papa.unparse(csvData);
    
    // UTF-8 BOM 추가 (Excel에서 한글 깨짐 방지)
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvString], { type: 'text/csv;charset=utf-8;' });
    
    // 파일 다운로드 로직
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    
    // 파일명 설정 (예: reviews_2023-10-27.csv)
    const today = new Date();
    const dateString = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    link.setAttribute("download", `reviews_${dateString}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  // ▲▲▲ 수정 완료 ▲▲▲

  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };
  
  const handleVerify = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 리뷰 인증 처리하시겠습니까?`)) return;
    const promises = Array.from(selected).map(id => 
        updateDoc(doc(db, 'reviews', id), { status: 'verified', verifiedAt: serverTimestamp() })
    );
    await Promise.all(promises);
    alert('리뷰 인증이 완료되었습니다.');
    await fetchReviews();
    setSelected(new Set());
  };
  
  const handleDelete = async () => {
    if (selected.size === 0) {
      alert('삭제할 항목을 선택해주세요.');
      return;
    }
    if (!window.confirm(`선택된 ${selected.size}개의 리뷰 항목을 영구적으로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selected).map(id => deleteDoc(doc(db, 'reviews', id)));
      await Promise.all(deletePromises);
      alert(`${selected.size}개의 항목이 성공적으로 삭제되었습니다.`);
      await fetchReviews();
      setSelected(new Set());
    } catch (error) {
      console.error("리뷰 삭제 실패:", error);
      alert('항목 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt("반려 사유를 입력하세요:");
    if (reason === null || !reason.trim()) {
      if(reason !== null) alert("반려 사유를 반드시 입력해야 합니다.");
      return;
    }
    if (window.confirm(`이 리뷰를 반려 처리하시겠습니까?\n사유: ${reason}`)) {
      await updateDoc(doc(db, 'reviews', id), { status: 'rejected', rejectionReason: reason.trim(), rejectedAt: serverTimestamp() });
      alert('리뷰가 반려 처리되었습니다.');
      await fetchReviews();
    }
  };

  const openDetailModal = (review) => { setSelectedReview(review); setIsModalOpen(true); };
  const closeDetailModal = () => { setIsModalOpen(false); setSelectedReview(null); };

  if (loading) return <p>리뷰 정보를 불러오는 중...</p>;

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <>
      <h2>리뷰 관리 ({processedRows.length})</h2>
      <div className="toolbar">
        <button onClick={handleVerify} disabled={selected.size === 0} className="verify-button-toolbar">선택 항목 리뷰 인증</button>
        <button onClick={handleDelete} disabled={selected.size === 0} className="delete-button-toolbar">선택 항목 삭제</button>
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <div className="table-container">
        <table>
          {/* ... the rest of your component */}
          {/* thead, tbody ... */}
          <thead>
            <tr>
              <th><input type="checkbox" checked={selected.size === processedRows.length && processedRows.length > 0} onChange={toggleSelectAll} /></th>
              <th onClick={() => requestSort('createdAt')} className="sortable">등록일시<SortIndicator columnKey="createdAt" /></th>
              <th onClick={() => requestSort('status')} className="sortable">상태<SortIndicator columnKey="status" /></th>
              <th onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('reviewType')} className="sortable">결제 종류<SortIndicator columnKey="reviewType" /></th>
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
              <th></th>
              <th></th>
              <th>
                <select name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="all">전체</option>
                  {Object.values(statusMap).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              <th><input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewType" value={filters.reviewType} onChange={handleFilterChange} /></th>
              <th><input type="text" name="mainAccountName" value={filters.mainAccountName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="name" value={filters.name} onChange={handleFilterChange} /></th>
              <th><input type="text" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} /></th>
              <th></th>
              <th></th>
              <th></th>
              <th>
                <select name="reviewConfirm" value={filters.reviewConfirm} onChange={handleFilterChange}>
                  <option value="all">전체</option>
                  <option value="O">O</option>
                  <option value="X">X</option>
                </select>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                <td>{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</td>
                <td>{statusMap[r.status] || r.status}</td>
                <td className="product-name-cell">{r.productName || '-'}</td>
                <td>{r.reviewType || '-'}</td>
                <td>{r.mainAccountName || '-'}</td>
                <td>{r.name || '-'}</td>
                <td>{r.phoneNumber || '-'}</td>
                <td>{r.paymentType || '-'}</td>
                <td>{r.productType || '-'}</td>
                <td>{r.reviewOption || '-'}</td>
                <td>
                  <button className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>
                    {r.confirmImageUrls?.length > 0 ? 'O' : 'X'}
                  </button>
                </td>
                <td><button onClick={() => handleReject(r.id)} className="reject-button">반려</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />
      )}
    </>
  );
}
