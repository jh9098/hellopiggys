// src/pages/AdminProductManagement.jsx (최종 수정 완료)

import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from '../firebaseConfig';
import Papa from 'papaparse';

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
      setSelectedIds(processedProducts.map(p => p.id));
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
        <Link to="/admin/products/new" className="action-button">상품 생성</Link>
      </div>
      <div className="toolbar">
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <div className="toolbar">
        <button onClick={deleteSelected}>선택 삭제</button>
        <select value={bulkReviewType} onChange={(e) => setBulkReviewType(e.target.value)}>
          <option value="">결제 종류 일괄 변경</option>
          {reviewTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => { bulkUpdate('reviewType', bulkReviewType); setBulkReviewType(''); }}>적용</button>
        <select value={bulkProductType} onChange={(e) => setBulkProductType(e.target.value)}>
          <option value="">상품 종류 일괄 변경</option>
          {productTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={() => { bulkUpdate('productType', bulkProductType); setBulkProductType(''); }}>적용</button>
        <select value={bulkReviewOption} onChange={(e) => setBulkReviewOption(e.target.value)}>
          <option value="">리뷰 종류 일괄 변경</option>
          {fullReviewOptions.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={() => { bulkUpdate('reviewOption', bulkReviewOption); setBulkReviewOption(''); }}>적용</button>
      </div>
      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === processedProducts.length && processedProducts.length > 0} /></th>
              <th onClick={() => requestSort('productName')} className="sortable">상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('reviewType')} className="sortable">결제 종류<SortIndicator columnKey="reviewType" /></th>
              <th onClick={() => requestSort('productType')} className="sortable">상품 종류<SortIndicator columnKey="productType" /></th>
              <th onClick={() => requestSort('reviewOption')} className="sortable">리뷰 종류<SortIndicator columnKey="reviewOption" /></th>
              <th onClick={() => requestSort('reviewDate')} className="sortable">진행일자<SortIndicator columnKey="reviewDate" /></th>
              <th onClick={() => requestSort('progressStatus')} className="sortable">진행 상태<SortIndicator columnKey="progressStatus" /></th>
              <th onClick={() => requestSort('createdAt')} className="sortable">등록날짜<SortIndicator columnKey="createdAt" /></th>
              <th>관리</th>
            </tr>
            <tr className="filter-row">
              <th></th>
              <th><input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewType" value={filters.reviewType} onChange={handleFilterChange} /></th>
              <th><input type="text" name="productType" value={filters.productType} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewOption" value={filters.reviewOption} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewDate" value={filters.reviewDate} onChange={handleFilterChange} /></th>
              <th><select name="progressStatus" value={filters.progressStatus} onChange={handleFilterChange}><option value="all">전체</option>{progressStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></th>
              <th></th><th></th>
            </tr>
          </thead>
          <tbody>
          {processedProducts.length > 0 ? processedProducts.map(p => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={() => handleSelectOne(p.id)} /></td>
                <td style={{textAlign: 'left'}}>{p.productName}</td>
                <td>
                  <select value={p.reviewType || '현영'} onChange={(e) => handleFieldChange(p.id, 'reviewType', e.target.value)}>
                    {reviewTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>
                  <select value={p.productType || '실배송'} onChange={(e) => handleFieldChange(p.id, 'productType', e.target.value)}>
                    {productTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>
                  <select value={p.reviewOption || '별점'} onChange={(e) => handleFieldChange(p.id, 'reviewOption', e.target.value)}>
                    {(p.productType === '빈박스' ? limitedReviewOptions : fullReviewOptions).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>{p.reviewDate}</td>
                <td><select value={p.progressStatus || '진행전'} onChange={(e) => handleStatusChange(p.id, e.target.value)}><option value="">선택</option>{progressStatusOptions.map(s => (<option key={s} value={s}>{s}</option>))}</select></td>
                <td>{formatDate(p.createdAt)}</td>
                <td className="actions-cell">
                  {/* ▼▼▼ 관리 버튼 그룹 수정 ▼▼▼ */}
                  <button className="table-edit-btn" onClick={() => navigate(`/admin/products/edit/${p.id}`)}>수정</button>
                  <button className="table-copy-btn" onClick={() => handleCopyGuide(p.guide)}>가이드복사</button>
                  <button onClick={() => handleDelete(p.id)} className="table-delete-btn">삭제</button>
                  {/* ▲▲▲ 수정 완료 ▲▲▲ */}
                </td>
              </tr>
            )) : (
              <tr><td colSpan="9" style={{ padding: '50px', textAlign: 'center' }}>생성된 상품이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}