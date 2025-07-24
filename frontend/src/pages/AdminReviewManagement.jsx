// src/pages/AdminReviewManagement.jsx (24시간 표기 수정)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, getDoc, deleteDoc } from '../firebaseConfig';
import Papa from 'papaparse';
import ReviewDetailModal from '../components/ReviewDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

// 구매폼 등록일시 표시용 날짜 포맷 (YY.MM.DD HH시MM분)
const formatTimestamp24h = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  const date = new Date(timestamp.seconds * 1000);
  const yy = date.getFullYear().toString().slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}시${mi}분`;
};

const statusMap = {
  uploading_images: '이미지 업로드 중',
  submitted: '구매 완료',
  review_completed: '리뷰 완료',
  verified: '리뷰 인증 완료',
  rejected: '반려됨',
  settled: '정산 완료'
};
const getStatusKeyByValue = (value) => Object.keys(statusMap).find(key => statusMap[key] === value);
const getDisplayStatus = (review) => {
  const needsImages =
    !review.keywordAndLikeImagesUrls?.length ||
    !(review.orderImageUrls?.length > 0 || review.cashcardImageUrls?.length > 0);
  return needsImages ? '이미지 업로드 중' : (statusMap[review.status] || review.status);
};
const initialFilters = { productName: '', mainAccountName: '', name: '', phoneNumber: '', status: 'all', reviewConfirm: 'all' };

export default function AdminReviewManagementPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0); // pagination group index
  const itemsPerPage = 50;
  const pagesPerGroup = 10;

  const fetchReviews = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const allReviews = await Promise.all(
      snap.docs.map(async (d) => {
        const review = { id: d.id, ...d.data() };
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
            delete subAccountData.createdAt;
            Object.assign(review, subAccountData);
          }
        }
        return review;
      })
    );
    // 리뷰 인증 완료된 항목은 정산 관리 페이지에서 다루므로 목록에서 제외한다
    const reviewsData = allReviews.filter(
      (r) => r.status !== 'settled' && r.status !== 'verified'
    );
    setRows(reviewsData);
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, []);

  const processedRows = useMemo(() => {
    let filtered = [...rows];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(row => {
        if (key === 'status') return getDisplayStatus(row) === value;
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

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedRows.slice(startIndex, startIndex + itemsPerPage);
  }, [processedRows, currentPage]);

  // Reset to first page when filters change to ensure results are visible
  useEffect(() => {
    setCurrentPage(1);
    setPageGroup(0);
  }, [filters]);

  const totalPages = Math.ceil(processedRows.length / itemsPerPage);
  // ensure page group follows current page
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);
  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  
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
  const toggleSelectAll = (e) => setSelected(e.target.checked ? new Set(paginatedRows.map(r => r.id)) : new Set());

  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

  const downloadCsv = () => {
    if (processedRows.length === 0) return alert('다운로드할 데이터가 없습니다.');
    const toText = (v, excelText = false) => `="${(v ?? '').toString()}"`;
    const csvData = processedRows.map(r => ({
      '진행일자': toText(r.productInfo?.reviewDate || '-'),
      '결제종류': toText(r.paymentType || (r.isVatApplied ? '현영' : '자율결제')),
      '상품종류': toText(r.productType || '-'),
      '주문번호': toText(r.orderNumber || '-'),
      '상품명': toText(r.productInfo?.productName || r.productName || '-'),
      '본계정이름': toText(r.mainAccountName || '-'),
      '타계정이름(수취인)': toText(r.name || '-'),
      '전화번호': toText(r.phoneNumber || '-', true),
      '주소': toText(r.address || '-'),
      '은행': toText(r.bank || '-'),
      '계좌번호': toText(r.bankNumber || '', true),
      '금액': toText(r.rewardAmount || '0'),
      '예금주': toText(r.accountHolderName || '-'),
    }));
    const csv = Papa.unparse(csvData, { header: true });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `리뷰정보파일_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <Button variant="outline" size="sm" onClick={handleVerify} disabled={selected.size === 0}>선택 항목 리뷰 인증</Button>
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={selected.size === 0}>선택 항목 삭제</Button>
        {/* [수정] variant를 "secondary"로 변경 */}
        <Button variant="secondary" size="sm" onClick={resetFilters}>필터 초기화</Button>
        <Button variant="outline" size="sm" onClick={downloadCsv}>엑셀 다운로드</Button>
      </div>
      <div className="table-container">
        <Table className="admin-table">
          <TableHeader>
            <TableRow>
              <TableHead><input type="checkbox" checked={paginatedRows.length > 0 && paginatedRows.every(r => selected.has(r.id))} onChange={toggleSelectAll} /></TableHead>
              <TableHead onClick={() => requestSort('createdAt')} className="sortable">구매폼 등록일시<SortIndicator columnKey="createdAt" /></TableHead>
              <TableHead onClick={() => requestSort('status')} className="sortable">상태<SortIndicator columnKey="status" /></TableHead>
              <TableHead onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></TableHead>
              <TableHead onClick={() => requestSort('mainAccountName')} className="sortable">본계정<SortIndicator columnKey="mainAccountName" /></TableHead>
              <TableHead onClick={() => requestSort('name')} className="sortable">타계정<SortIndicator columnKey="name" /></TableHead>
              <TableHead onClick={() => requestSort('phoneNumber')} className="sortable">전화번호<SortIndicator columnKey="phoneNumber" /></TableHead>
              <TableHead onClick={() => requestSort('paymentType')} className="sortable">결제유형<SortIndicator columnKey="paymentType" /></TableHead>
              <TableHead onClick={() => requestSort('productType')} className="sortable">상품종류<SortIndicator columnKey="productType" /></TableHead>
              <TableHead onClick={() => requestSort('reviewOption')} className="sortable">리뷰종류<SortIndicator columnKey="reviewOption" /></TableHead>
              <TableHead>리뷰 인증</TableHead>
              <TableHead>작업</TableHead>
            </TableRow>
            <TableRow className="filter-row">
              <TableHead></TableHead><TableHead></TableHead>
              <TableHead>
                <select name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="all">전체</option>
                  {Object.entries(statusMap)
                    .filter(([key]) => !['settled', 'verified'].includes(key))
                    .map(([, label]) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                </select>
              </TableHead>
              <TableHead><Input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="mainAccountName" value={filters.mainAccountName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="name" value={filters.name} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} /></TableHead>
              <TableHead></TableHead><TableHead></TableHead><TableHead></TableHead>
              <TableHead><select name="reviewConfirm" value={filters.reviewConfirm} onChange={handleFilterChange}><option value="all">전체</option><option value="O">O</option><option value="X">X</option></select></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></TableCell>
                {/* [수정] 헬퍼 함수 사용 */}
                <TableCell>{formatTimestamp24h(r.createdAt)}</TableCell>
                <TableCell>{getDisplayStatus(r)}</TableCell>
                <TableCell className="product-name-cell">{r.productName || '-'}</TableCell>
                <TableCell className="nowrap-cell">{r.mainAccountName || '-'}</TableCell>
                <TableCell className="nowrap-cell">{r.name || '-'}</TableCell>
                <TableCell>{r.phoneNumber || '-'}</TableCell>
                <TableCell>{r.paymentType || (r.isVatApplied ? '현영' : '자율결제')}</TableCell>
                <TableCell>{r.productType || '-'}</TableCell>
                <TableCell>{r.reviewOption || '-'}</TableCell>
                <TableCell><Button variant="link" size="sm" className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>{r.confirmImageUrls?.length > 0 ? 'O' : 'X'}</Button></TableCell>
                <TableCell><Button variant="destructive" size="sm" onClick={() => handleReject(r.id)} className="reject-button">반려</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="pagination">
        <Button variant="outline" size="sm" onClick={prevGroup} disabled={pageGroup === 0}>{'<<'}</Button>
        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>{'<'}</Button>
        {Array.from({ length: Math.min(pagesPerGroup, totalPages - pageGroup * pagesPerGroup) }, (_, i) => {
          const pageNum = pageGroup * pagesPerGroup + i + 1;
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => goToPage(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>{'>'}</Button>
        <Button variant="outline" size="sm" onClick={nextGroup} disabled={(pageGroup + 1) * pagesPerGroup >= totalPages}>{'>>'}</Button>
      </div>
      {isModalOpen && <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />}
    </>
  );
}