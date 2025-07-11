// src/pages/AdminProductManagement.jsx (상품/리뷰 종류 컬럼 추가)

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from '../firebaseConfig';
import Papa from 'papaparse';

const formatDate = (date) => date ? new Date(date.seconds * 1000).toLocaleDateString() : 'N/A';
const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];

export default function AdminProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    productName: '',
    reviewType: '',
    reviewDate: '',
    progressStatus: 'all',
    productType: '', // 필터 상태 추가
    reviewOption: '', // 필터 상태 추가
  });
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });

  const fetchProducts = async () => {
    setLoading(true);
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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
    productName: '',
    reviewType: '',
    reviewDate: '',
    progressStatus: 'all',
    productType: '',
    reviewOption: '',
  });

  const downloadCsv = () => {
    const csvData = processedProducts.map(p => ({
      '상품명': p.productName || '-',
      '결제 종류': p.reviewType || '-',
      '상품 종류': p.productType || '-', // 엑셀 다운로드에 추가
      '리뷰 종류': p.reviewOption || '-', // 엑셀 다운로드에 추가
      '진행일자': p.reviewDate || '-',
      '진행 상태': p.progressStatus || '-',
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
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, { progressStatus: newStatus });
      setProducts(prevProducts =>
        prevProducts.map(p => (p.id === id ? { ...p, progressStatus: newStatus } : p))
      );
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다: ' + error.message);
    }
  };

  if (loading) return <p>상품 목록을 불러오는 중...</p>;

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>상품 관리 ({processedProducts.length})</h2>
        <Link to="/admin/products/new" style={{ padding: '8px 16px', backgroundColor: '#000', color: '#fff', textDecoration: 'none', borderRadius: '4px' }}>
          상품 생성
        </Link>
      </div>
      <div className="toolbar">
        <button onClick={resetFilters}>필터 초기화</button>
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '1000px' }}>
          <thead>
            <tr>
              {/* ▼▼▼ 컬럼 너비 조정 및 추가 ▼▼▼ */}
              <th onClick={() => requestSort('productName')} className="sortable" style={{width: '20%'}}>상품명<SortIndicator columnKey="productName" /></th>
              <th onClick={() => requestSort('reviewType')} className="sortable" style={{width: '10%'}}>결제 종류<SortIndicator columnKey="reviewType" /></th>
              <th onClick={() => requestSort('productType')} className="sortable" style={{width: '10%'}}>상품 종류<SortIndicator columnKey="productType" /></th>
              <th onClick={() => requestSort('reviewOption')} className="sortable" style={{width: '10%'}}>리뷰 종류<SortIndicator columnKey="reviewOption" /></th>
              <th onClick={() => requestSort('reviewDate')} className="sortable" style={{width: '10%'}}>진행일자<SortIndicator columnKey="reviewDate" /></th>
              <th onClick={() => requestSort('progressStatus')} className="sortable" style={{width: '10%'}}>진행 상태<SortIndicator columnKey="progressStatus" /></th>
              <th onClick={() => requestSort('createdAt')} className="sortable" style={{width: '10%'}}>등록날짜<SortIndicator columnKey="createdAt" /></th>
              <th style={{width: '10%'}}>관리</th>
            </tr>
            <tr className="filter-row">
              <th><input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewType" value={filters.reviewType} onChange={handleFilterChange} /></th>
              <th><input type="text" name="productType" value={filters.productType} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewOption" value={filters.reviewOption} onChange={handleFilterChange} /></th>
              <th><input type="text" name="reviewDate" value={filters.reviewDate} onChange={handleFilterChange} /></th>
              <th>
                <select name="progressStatus" value={filters.progressStatus} onChange={handleFilterChange}>
                  <option value="all">전체</option>
                  {progressStatusOptions.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </th>
              <th></th>
              <th></th>
              {/* ▲▲▲ 필터 컬럼 추가 ▲▲▲ */}
            </tr>
          </thead>
          <tbody>
          {processedProducts.length > 0 ? processedProducts.map(product => (
              <tr key={product.id}>
                <td style={{textAlign: 'left'}}>{product.productName}</td>
                <td>{product.reviewType}</td>
                {/* ▼▼▼ 데이터 표시 컬럼 추가 ▼▼▼ */}
                <td>{product.productType || '-'}</td>
                <td>{product.reviewOption || '-'}</td>
                <td>{product.reviewDate}</td>
                <td>
                  <select 
                    value={product.progressStatus || '진행전'} 
                    onChange={(e) => handleStatusChange(product.id, e.target.value)}
                    style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    {progressStatusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td>{formatDate(product.createdAt)}</td>
                <td style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                  <Link to={`/admin/products/edit/${product.id}`} style={{ backgroundColor: '#1976d2', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', textDecoration: 'none' }}>
                    수정
                  </Link>
                  <button onClick={() => handleDelete(product.id)} style={{ backgroundColor: '#e53935', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>
                    삭제
                  </button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="8" style={{ padding: '50px', textAlign: 'center' }}>
                  생성된 상품이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}