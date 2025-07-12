// src/pages/AdminProductManagement.jsx (기존 CSS 적용 최종본)

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from '../firebaseConfig';
import Papa from 'papaparse';

const formatDate = (date) => date ? new Date(date.seconds * 1000).toLocaleDateString() : 'N/A';
const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];

export default function AdminProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    productName: '', reviewType: '', reviewDate: '', progressStatus: 'all',
    productType: '', reviewOption: '',
  });
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

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

  if (loading) return <p>상품 목록을 불러오는 중...</p>;

  const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>상품 관리 ({processedProducts.length})</h2>
        <Link to="/admin/reviewer/products/new" className="action-button">상품 생성</Link>
      </div>
      <div className="toolbar">
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
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
                <td style={{textAlign: 'left'}}>{p.productName}</td>
                <td>{p.reviewType}</td>
                <td>{p.productType || '-'}</td>
                <td>{p.reviewOption || '-'}</td>
                <td>{p.reviewDate}</td>
                <td><select value={p.progressStatus || '진행전'} onChange={(e) => handleStatusChange(p.id, e.target.value)}><option value="">선택</option>{progressStatusOptions.map(s => (<option key={s} value={s}>{s}</option>))}</select></td>
                <td>{formatDate(p.createdAt)}</td>
                <td className="actions-cell"><Link to={`/admin/reviewer/products/edit/${p.id}`} className="edit-btn">수정</Link><button onClick={() => handleDelete(p.id)} className="delete-btn">삭제</button></td>
              </tr>
            )) : (
              <tr><td colSpan="8" style={{ padding: '50px', textAlign: 'center' }}>생성된 상품이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}