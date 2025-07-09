// src/pages/AdminSettlement.jsx (필터/정렬 및 계정 분리 최종본)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc, getDoc } from '../firebaseConfig';
import ReviewDetailModal from '../components/ReviewDetailModal';
import Papa from 'papaparse';

// 필터 초기 상태
const initialFilters = {
  productName: '',
  orderNumber: '',
  mainAccountName: '',
  subAccountName: '',
  phoneNumber: '',
  reviewConfirm: 'all',
};

export default function AdminSettlement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);

  // 1. 필터와 정렬을 위한 상태 추가
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'verifiedAt', direction: 'desc' });

  const fetchSettlementList = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', '==', 'verified'), orderBy('verifiedAt', 'desc'));
    const snap = await getDocs(q);

    const settlementData = await Promise.all(snap.docs.map(async (d) => {
      const review = { id: d.id, ...d.data() };
      
      // 상품 정보 가져오기
      if (review.productId) {
        const productRef = doc(db, 'products', review.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) review.productInfo = productSnap.data();
      }
      
      // 본계정 이름 조회
      if (review.mainAccountId) {
        const userDocRef = doc(db, 'users', review.mainAccountId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) review.mainAccountName = userDocSnap.data().name;
      }
      
      // 타계정 정보(subAccounts) 가져오기 및 이름 분리
      if (review.subAccountId) {
        const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
        const subAccountSnap = await getDoc(subAccountRef);
        if (subAccountSnap.exists()) {
          const subAccountData = subAccountSnap.data();
          // 타계정 정보 병합 및 이름 필드 명확화
          Object.assign(review, subAccountData); 
          review.subAccountName = subAccountData.name; // 타계정 이름 필드 생성
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

  // 2. 필터링과 정렬을 모두 처리하는 useMemo
const processedRows = useMemo(() => {
    let filtered = [...rows];

    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(row => {
        // productName은 productInfo 객체 안에 있을 수 있음
        const targetValue = key === 'productName'
          ? row.productInfo?.productName || row.productName
          : row[key];

        if (key === 'reviewConfirm') {
          const hasConfirmImages = row.confirmImageUrls && row.confirmImageUrls.length > 0;
          if (value === 'O') return hasConfirmImages;
          if (value === 'X') return !hasConfirmImages;
        }

        return targetValue?.toString().toLowerCase().includes(value.toLowerCase());
      });
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        // productName은 productInfo 안에 있을 수 있으므로 처리
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

  // --- 기존 함수들을 processedRows 기반으로 수정 ---
  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelected(new Set(processedRows.map(r => r.id)));
    else setSelected(new Set());
  };

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 삭제하시겠습니까?`)) return;
    await Promise.all(Array.from(selected).map(id => deleteDoc(doc(db, 'reviews', id))));
    alert('삭제되었습니다.');
    await fetchSettlementList(); // 목록 새로고침
    setSelected(new Set());
  };

  const handleSettle = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 정산 완료 처리하시겠습니까?`)) return;
    await Promise.all(Array.from(selected).map(id => updateDoc(doc(db, 'reviews', id), {
      status: 'settled',
      settledAt: serverTimestamp(),
    })));
    alert('정산 완료 처리되었습니다.');
    await fetchSettlementList(); // 목록 새로고침
    setSelected(new Set());
  };

  const downloadCsvForInfo = () => {
    if (processedRows.length === 0) {
      alert('다운로드할 정산 내역이 없습니다.');
      return;
    }

    const toText = (v, excelText = false) => {
      const str = (v ?? '').toString();
      return excelText ? `="${str}"` : str;
    };

    const csvData = processedRows.map(r => ({
      '상품명': toText(r.productInfo?.productName || r.productName || '-'),
      '진행일자': toText(r.productInfo?.reviewDate || '-'),
      '주문번호': toText(r.orderNumber || '-'),
      '본계정 이름': toText(r.mainAccountName || '-'), // 본계정 이름 추가
      '타계정 이름(수취인)': toText(r.subAccountName || '-'), // 타계정 이름 추가
      '전화번호': toText(r.phoneNumber || '-', true),
      '주소': toText(r.address || '-'),
      '은행': toText(r.bank || '-'),
      '계좌번호': toText(r.bankNumber || '', true),
      '예금주': toText(r.accountHolderName || '-'),
      '금액': toText(r.rewardAmount || '0'),
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

  const openDetailModal = (review) => {
    setSelectedReview(review);
    setIsModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsModalOpen(false);
    setSelectedReview(null);
  };

  if (loading) return <p>정산 내역을 불러오는 중...</p>;

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <>
      <h2>정산 내역 ({processedRows.length})</h2>
      <div className="toolbar">
        <button onClick={handleDelete} disabled={selected.size === 0} style={{backgroundColor: '#e53935', color: 'white'}}>선택삭제</button>
        <button onClick={handleSettle} disabled={selected.size === 0}>정산완료</button>
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsvForInfo} disabled={processedRows.length === 0} style={{backgroundColor: '#007bff', color: 'white'}}>
          정보 파일 다운로드
        </button>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            {/* 컬럼 헤더: 제목과 정렬 기능 */}
            <tr>
              <th><input type="checkbox" onChange={toggleSelectAll} checked={selected.size === processedRows.length && processedRows.length > 0} /></th>
              <th onClick={() => requestSort('verifiedAt')} className="sortable">리뷰 인증일<SortIndicator columnKey="verifiedAt" /></th>
              <th onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('mainAccountName')} className="sortable">본계정 이름<SortIndicator columnKey="mainAccountName" /></th>
              <th onClick={() => requestSort('subAccountName')} className="sortable">타계정 이름<SortIndicator columnKey="subAccountName" /></th>
              <th onClick={() => requestSort('phoneNumber')} className="sortable">전화번호<SortIndicator columnKey="phoneNumber" /></th>
              <th onClick={() => requestSort('orderNumber')} className="sortable">주문번호<SortIndicator columnKey="orderNumber" /></th>
              <th>리뷰 인증</th>
              <th onClick={() => requestSort('rewardAmount')} className="sortable">정산 금액<SortIndicator columnKey="rewardAmount" /></th>
            </tr>
            {/* 필터 행: 각 컬럼별 필터 입력 UI */}
            <tr className="filter-row">
              <th></th>
              <th></th> {/* 날짜 필터는 생략 */}
              <th><input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="mainAccountName" value={filters.mainAccountName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="subAccountName" value={filters.subAccountName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} /></th>
              <th><input type="text" name="orderNumber" value={filters.orderNumber} onChange={handleFilterChange} /></th>
              <th>
                <select name="reviewConfirm" value={filters.reviewConfirm} onChange={handleFilterChange}>
                  <option value="all">전체</option>
                  <option value="O">O</option>
                  <option value="X">X</option>
                </select>
              </th>
              <th></th> {/* 금액 필터는 생략 */}
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
                <td>{r.orderNumber || '-'}</td>
                <td>
                  <button className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>
                    {r.confirmImageUrls?.length > 0 ? 'O' : 'X'}
                  </button>
                </td>
                <td>{r.rewardAmount ? Number(r.rewardAmount).toLocaleString() + '원' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />
      )}
    </>
  );}