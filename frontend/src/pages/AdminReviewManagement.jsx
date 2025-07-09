// src/pages/AdminReviewManagement.jsx (엑셀 스타일 필터/정렬 기능 추가 최종본)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, getDoc } from '../firebaseConfig';
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

  // 1. 필터와 정렬을 위한 상태 추가
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const fetchReviews = async () => {
    setLoading(true);
    // status 필터링은 클라이언트에서 하므로 초기 쿼리는 범위를 넓게 잡습니다.
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
              Object.assign(review, subData); // 타계정 정보 병합
          }
      }
      return review;
    }));
    
    // verified 상태는 관리 페이지에서 보여주지 않음 (정산 페이지로 넘어감)
    setRows(reviewsData.filter(r => r.status !== 'verified'));
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  // 2. 필터링과 정렬을 모두 처리하는 useMemo
  const processedRows = useMemo(() => {
    let filtered = [...rows];

    // 필터링 로직
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;

      filtered = filtered.filter(row => {
        if (key === 'status') {
          return row.status === getStatusKeyByValue(value);
        }
        if (key === 'reviewConfirm') {
          const hasConfirmImages = row.confirmImageUrls && row.confirmImageUrls.length > 0;
          if (value === 'O') return hasConfirmImages;
          if (value === 'X') return !hasConfirmImages;
        }
        // 일반 텍스트 필터링
        return row[key]?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });

    // 정렬 로직
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
  
  // 3. 필터와 정렬을 위한 핸들러 함수들
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };
  
  const resetFilters = () => {
    setFilters(initialFilters);
  };

  // --- 기존 함수들은 processedRows를 사용하도록 수정 ---
  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelected(new Set(processedRows.map((r) => r.id)));
    else setSelected(new Set());
  };

  const downloadCsv = () => {
    const csvData = processedRows.map((r, i) => ({
      //... CSV 데이터 생성
    }));
    // ... 기존 다운로드 로직 동일
  };

  // --- 나머지 기존 함수들은 거의 동일 ---
  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };
  
  const handleVerify = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 리뷰 인증 처리하고 정산내역으로 넘기시겠습니까?`)) return;
    const promises = Array.from(selected).map(id => 
        updateDoc(doc(db, 'reviews', id), { status: 'verified', verifiedAt: serverTimestamp() })
    );
    await Promise.all(promises);
    alert('리뷰 인증이 완료되었습니다.');
    await fetchReviews(); // 목록 새로고침
    setSelected(new Set());
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
        <button onClick={handleVerify} disabled={selected.size === 0}>선택 항목 리뷰 인증</button>
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <div className="table-container"> {/* 테이블 스크롤을 위해 컨테이너 추가 */}
        <table>
          <thead>
            {/* 4. 컬럼 헤더: 제목과 정렬 기능 */}
            <tr>
              <th><input type="checkbox" checked={selected.size === processedRows.length && processedRows.length > 0} onChange={toggleSelectAll} /></th>
              <th onClick={() => requestSort('createdAt')} className="sortable">등록일시<SortIndicator columnKey="createdAt" /></th>
              <th onClick={() => requestSort('status')} className="sortable">상태<SortIndicator columnKey="status" /></th>
              <th onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('reviewType')} className="sortable">리뷰 종류<SortIndicator columnKey="reviewType" /></th>
              <th onClick={() => requestSort('mainAccountName')} className="sortable">본계정<SortIndicator columnKey="mainAccountName" /></th>
              <th onClick={() => requestSort('name')} className="sortable">타계정<SortIndicator columnKey="name" /></th>
              <th onClick={() => requestSort('phoneNumber')} className="sortable">전화번호<SortIndicator columnKey="phoneNumber" /></th>
              <th>리뷰 확인</th>            
              <th>작업</th>
            </tr>
            {/* 5. 필터 행: 각 컬럼별 필터 입력 UI */}
            <tr className="filter-row">
              <th></th>
              <th></th>{/* 등록일시 필터는 생략 */}
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
                <td>{r.productName || '-'}</td>
                <td>{r.reviewType || '-'}</td>
                <td>{r.mainAccountName || '-'}</td>
                <td>{r.name || '-'}</td>
                <td>{r.phoneNumber || '-'}</td>
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