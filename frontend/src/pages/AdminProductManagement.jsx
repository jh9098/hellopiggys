// src/pages/AdminProductManagement.jsx (최종 수정 완료)

import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from '../firebaseConfig';
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

const formatDate = (date) => date ? new Date(date.seconds * 1000).toLocaleDateString() : 'N/A';
const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];
const productTypeOptions = ['실배송', '빈박스'];
const reviewTypeOptions = ['현영', '자율결제'];
const fullReviewOptions = ['별점', '텍스트', '포토', '프리미엄(포토)', '프리미엄(영상)'];
const limitedReviewOptions = ['별점', '텍스트'];

export default function AdminProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    productName: '', reviewType: '', reviewDate: '', progressStatus: 'all',
    productType: '', reviewOption: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkReviewType, setBulkReviewType] = useState('');
  const [bulkProductType, setBulkProductType] = useState('');
  const [bulkReviewOption, setBulkReviewOption] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0);
  const itemsPerPage = 20;
  const pagesPerGroup = 10;
  const navigate = useNavigate();

  const fetchProducts = async () => {
    setLoading(true);
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const processedProducts = useMemo(() => {
    let filtered = [...products];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(p => p[key]?.toString().toLowerCase().includes(value.toLowerCase()));
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
  }, [products, filters, sortConfig]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [processedProducts, currentPage]);

  const totalPages = Math.ceil(processedProducts.length / itemsPerPage);
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);
  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 상품을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'products', id));
      alert('상품이 삭제되었습니다.');
      fetchProducts();
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const resetFilters = () => setFilters({
    productName: '', reviewType: '', reviewDate: '', progressStatus: 'all',
    productType: '', reviewOption: '',
  });

  const downloadCsv = () => {
    const csvData = processedProducts.map(p => ({
      '상품명': p.productName || '-', '결제 종류': p.reviewType || '-',
      '상품 종류': p.productType || '-', '리뷰 종류': p.reviewOption || '-',
      '진행일자': p.reviewDate || '-', '진행 상태': p.progressStatus || '-',
      '등록날짜': formatDate(p.createdAt),
    }));
    const csv = Papa.unparse(csvData, { header: true });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'products', id), { progressStatus: newStatus });
      setProducts(prev => prev.map(p => (p.id === id ? { ...p, progressStatus: newStatus } : p)));
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleFieldChange = async (id, field, value) => {
    try {
      await updateDoc(doc(db, 'products', id), { [field]: value });
      setProducts(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
    } catch (err) {
      alert('정보 수정 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedProducts.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm('선택한 상품을 모두 삭제하시겠습니까?')) return;
    for (const id of selectedIds) {
      await deleteDoc(doc(db, 'products', id));
    }
    setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  const bulkUpdate = async (field, value) => {
    if (!value || selectedIds.length === 0) return;
    const updates = selectedIds.map(id => updateDoc(doc(db, 'products', id), { [field]: value }));
    await Promise.all(updates);
    setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, [field]: value } : p));
  };

  // [수정] 가이드 복사 핸들러
  const handleCopyGuide = (guideText) => {
    if (!guideText) {
        alert('복사할 가이드 내용이 없습니다.');
        return;
    }
    navigator.clipboard.writeText(guideText)
      .then(() => {
        alert('가이드가 복사되었습니다!');
      })
      .catch(err => {
        alert('가이드 복사에 실패했습니다.');
        console.error('Could not copy text: ', err);
      });
  };


  if (loading) return <p>상품 목록을 불러오는 중...</p>;

  const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>상품 관리 ({processedProducts.length})</h2>
        <Button asChild>
          <Link to="/admin/products/new">상품 생성</Link>
        </Button>
      </div>
      <div className="toolbar">
        <Button variant="outline" size="sm" onClick={resetFilters}>필터 초기화</Button>
        <Button variant="outline" size="sm" onClick={downloadCsv}>엑셀 다운로드</Button>
      </div>
      <div className="toolbar">
        <Button variant="destructive" size="sm" onClick={deleteSelected}>선택 삭제</Button>
      </div>
      <div className="table-container">
        <Table className="admin-table">
          <TableHeader>
            <TableRow>
              <TableHead><input type="checkbox" onChange={handleSelectAll} checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.includes(p.id))} /></TableHead>
              <TableHead onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></TableHead>
              <TableHead onClick={() => requestSort('reviewType')} className="sortable">결제 종류<SortIndicator columnKey="reviewType" /></TableHead>
              <TableHead onClick={() => requestSort('productType')} className="sortable">상품 종류<SortIndicator columnKey="productType" /></TableHead>
              <TableHead onClick={() => requestSort('reviewOption')} className="sortable">리뷰 종류<SortIndicator columnKey="reviewOption" /></TableHead>
              <TableHead onClick={() => requestSort('reviewDate')} className="sortable">진행일자<SortIndicator columnKey="reviewDate" /></TableHead>
              <TableHead onClick={() => requestSort('progressStatus')} className="sortable">진행 상태<SortIndicator columnKey="progressStatus" /></TableHead>
              <TableHead onClick={() => requestSort('createdAt')} className="sortable">등록날짜<SortIndicator columnKey="createdAt" /></TableHead>
              <TableHead>관리</TableHead>
            </TableRow>
            <TableRow className="bulk-row">
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkReviewType} onChange={(e) => setBulkReviewType(e.target.value)}>
                    <option value="">결제 종류 일괄 변경</option>
                    {reviewTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('reviewType', bulkReviewType); setBulkReviewType(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkProductType} onChange={(e) => setBulkProductType(e.target.value)}>
                    <option value="">상품 종류 일괄 변경</option>
                    {productTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('productType', bulkProductType); setBulkProductType(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkReviewOption} onChange={(e) => setBulkReviewOption(e.target.value)}>
                    <option value="">리뷰 종류 일괄 변경</option>
                    {fullReviewOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('reviewOption', bulkReviewOption); setBulkReviewOption(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
            <TableRow className="filter-row">
              <TableHead></TableHead>
              <TableHead><Input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="reviewType" value={filters.reviewType} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="productType" value={filters.productType} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="reviewOption" value={filters.reviewOption} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="reviewDate" value={filters.reviewDate} onChange={handleFilterChange} /></TableHead>
              <TableHead><select name="progressStatus" value={filters.progressStatus} onChange={handleFilterChange}><option value="all">전체</option>{progressStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
          {processedProducts.length > 0 ? paginatedProducts.map(p => (
              <TableRow key={p.id}>
                <TableCell><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} /></TableCell>
                <TableCell style={{textAlign: 'left'}}>{p.productName}</TableCell>
                <TableCell>
                  <select value={p.reviewType || '현영'} onChange={(e) => handleFieldChange(p.id, 'reviewType', e.target.value)}>
                    {reviewTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </TableCell>
                <TableCell>
                  <select value={p.productType || '실배송'} onChange={(e) => handleFieldChange(p.id, 'productType', e.target.value)}>
                    {productTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </TableCell>
                <TableCell>
                  <select value={p.reviewOption || '별점'} onChange={(e) => handleFieldChange(p.id, 'reviewOption', e.target.value)}>
                    {(p.productType === '빈박스' ? limitedReviewOptions : fullReviewOptions).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </TableCell>
                <TableCell>{p.reviewDate}</TableCell>
                <TableCell><select value={p.progressStatus || '진행전'} onChange={(e) => handleStatusChange(p.id, e.target.value)}><option value="">선택</option>{progressStatusOptions.map(s => (<option key={s} value={s}>{s}</option>))}</select></TableCell>
                <TableCell>{formatDate(p.createdAt)}</TableCell>
                <TableCell className="actions-cell">
                  <Button size="sm" className="table-edit-btn" onClick={() => navigate(`/admin/products/edit/${p.id}`)}>수정</Button>
                  <Button size="sm" className="table-copy-btn" onClick={() => handleCopyGuide(p.guide)}>가이드복사</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id)} className="table-delete-btn">삭제</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan="9" style={{ padding: '50px', textAlign: 'center' }}>생성된 상품이 없습니다.</TableCell></TableRow>
            )}
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
    </>
  );
}