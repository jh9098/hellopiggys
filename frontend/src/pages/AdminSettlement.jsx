// src/pages/AdminSettlement.jsx (24시간 표기 수정)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, deleteDoc, getDoc } from '../firebaseConfig';
import ReviewDetailModal from '../components/ReviewDetailModal';
import Papa from 'papaparse';
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

// [추가] 24시간제 날짜 포맷 함수
const formatTimestamp24h = (timestamp) => {
  if (!timestamp || !timestamp.seconds) return '';
  return new Date(timestamp.seconds * 1000).toLocaleString('ko-KR', { hour12: false });
};

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0);
  const itemsPerPage = 50;
  const pagesPerGroup = 10;

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

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedRows.slice(startIndex, startIndex + itemsPerPage);
  }, [processedRows, currentPage]);

  const totalPages = Math.ceil(processedRows.length / itemsPerPage);
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);
  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

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
    const csvData = processedRows.map(r => {
      const amount = Number(r.rewardAmount || 0);
      const amountCheck = r.paymentType === '현영' ? Math.floor(amount * 1.06) : amount;
      return {
        '진행일자': toText(r.productInfo?.reviewDate || '-'),
        '결제종류': toText(r.paymentType || '-'),
        '상품종류': toText(r.productType || '-'),
        '주문번호': toText(r.orderNumber || '-'),
        '상품명': toText(r.productInfo?.productName || r.productName || '-'),
        '본계정이름': toText(r.mainAccountName || '-'),
        '타계정이름(수취인)': toText(r.subAccountName || '-'),
        '전화번호': toText(r.phoneNumber || '-', true),
        '주소': toText(r.address || '-'),
        '은행': toText(r.bank || '-'),
        '계좌번호': toText(r.bankNumber || '', true),
        '금액': toText(r.rewardAmount || '0'),
        '예금주': toText(r.accountHolderName || '-'),
        '금액확인': toText(amountCheck),
      };
    });
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
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={selected.size === 0}>선택삭제</Button>
        <Button variant="outline" size="sm" onClick={handleSettle} disabled={selected.size === 0}>정산완료</Button>
        {/* [수정] variant를 "secondary"로 변경 */}
        <Button variant="secondary" size="sm" onClick={resetFilters}>필터 초기화</Button>
        <Button variant="outline" size="sm" onClick={downloadCsvForInfo} disabled={processedRows.length === 0}>정보 파일 다운로드</Button>
      </div>
      <div className="table-container">
        <Table className="admin-table">
          <TableHeader>
            <TableRow>
              <TableHead><input type="checkbox" onChange={toggleSelectAll} checked={paginatedRows.length > 0 && paginatedRows.every(r => selected.has(r.id))} /></TableHead>
              <TableHead onClick={() => requestSort('verifiedAt')} className="sortable">리뷰 인증일<SortIndicator columnKey="verifiedAt" /></TableHead>
              <TableHead onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></TableHead>
              <TableHead onClick={() => requestSort('mainAccountName')} className="sortable">본계정 이름<SortIndicator columnKey="mainAccountName" /></TableHead>
              <TableHead onClick={() => requestSort('subAccountName')} className="sortable">타계정 이름<SortIndicator columnKey="subAccountName" /></TableHead>
              <TableHead onClick={() => requestSort('phoneNumber')} className="sortable">전화번호<SortIndicator columnKey="phoneNumber" /></TableHead>
              <TableHead onClick={() => requestSort('paymentType')} className="sortable">결제유형<SortIndicator columnKey="paymentType" /></TableHead>
              <TableHead onClick={() => requestSort('productType')} className="sortable">상품종류<SortIndicator columnKey="productType" /></TableHead>
              <TableHead onClick={() => requestSort('reviewOption')} className="sortable">리뷰종류<SortIndicator columnKey="reviewOption" /></TableHead>
              <TableHead onClick={() => requestSort('orderNumber')} className="sortable">주문번호<SortIndicator columnKey="orderNumber" /></TableHead>
              <TableHead>리뷰 인증</TableHead>
              <TableHead onClick={() => requestSort('rewardAmount')} className="sortable">정산 금액<SortIndicator columnKey="rewardAmount" /></TableHead>
            </TableRow>
            <TableRow className="filter-row">
              <TableHead></TableHead><TableHead></TableHead>
              <TableHead><Input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="mainAccountName" value={filters.mainAccountName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="subAccountName" value={filters.subAccountName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="phoneNumber" value={filters.phoneNumber} onChange={handleFilterChange} /></TableHead>
              <TableHead></TableHead><TableHead></TableHead><TableHead></TableHead>
              <TableHead><Input type="text" name="orderNumber" value={filters.orderNumber} onChange={handleFilterChange} /></TableHead>
              <TableHead><select name="reviewConfirm" value={filters.reviewConfirm} onChange={handleFilterChange}><option value="all">전체</option><option value="O">O</option><option value="X">X</option></select></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></TableCell>
                {/* [수정] 헬퍼 함수 사용 */}
                <TableCell>{formatTimestamp24h(r.verifiedAt)}</TableCell>
                <TableCell>{r.productInfo?.productName || r.productName || '-'}</TableCell>
                <TableCell>{r.mainAccountName || '-'}</TableCell>
                <TableCell>{r.subAccountName || '-'}</TableCell>
                <TableCell>{r.phoneNumber || '-'}</TableCell>
                <TableCell>{r.paymentType || '-'}</TableCell>
                <TableCell>{r.productType || '-'}</TableCell>
                <TableCell>{r.reviewOption || '-'}</TableCell>
                <TableCell>{r.orderNumber || '-'}</TableCell>
                <TableCell><Button className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>{r.confirmImageUrls?.length > 0 ? 'O' : 'X'}</Button></TableCell>
                <TableCell>{r.rewardAmount ? Number(r.rewardAmount).toLocaleString() + '원' : '-'}</TableCell>
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