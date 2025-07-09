// src/pages/AdminProductManagement.jsx (진행 상태 컬럼 및 상태 변경 기능 추가)

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from '../firebaseConfig';

const formatDate = (date) => date ? new Date(date.seconds * 1000).toLocaleDateString() : 'N/A';
const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];

export default function AdminProductManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 상품을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'products', id));
      alert('상품이 삭제되었습니다.');
      fetchProducts();
    }
  };

  // 진행 상태 변경 핸들러
  const handleStatusChange = async (id, newStatus) => {
    try {
      const productRef = doc(db, 'products', id);
      await updateDoc(productRef, { progressStatus: newStatus });
      
      // 화면 상태 즉시 업데이트
      setProducts(prevProducts =>
        prevProducts.map(p => (p.id === id ? { ...p, progressStatus: newStatus } : p))
      );
      // alert('상태가 변경되었습니다.'); // 너무 잦은 알림 방지를 위해 주석 처리
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다: ' + error.message);
    }
  };


  if (loading) return <p>상품 목록을 불러오는 중...</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>상품 관리 ({products.length})</h2>
        <Link to="/admin/products/new" style={{ padding: '8px 16px', backgroundColor: '#000', color: '#fff', textDecoration: 'none', borderRadius: '4px' }}>
          상품 생성
        </Link>
      </div>
      
      {/* 테이블 레이아웃을 div로 감싸서 반응형 스크롤을 지원합니다. */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: '800px' }}> {/* 최소 너비 지정 */}
          <thead>
            <tr>
              <th style={{width: '20%'}}>상품명</th>
              <th style={{width: '15%'}}>리뷰 종류</th>
              <th style={{width: '15%'}}>진행일자</th>
              <th style={{width: '15%'}}>진행 상태</th> {/* 상태 컬럼 추가 */}
              <th style={{width: '15%'}}>등록날짜</th>
              <th style={{width: '20%'}}>관리</th>
            </tr>
          </thead>
          <tbody>
          {products.length > 0 ? products.map(product => (
              <tr key={product.id}>
                <td style={{textAlign: 'left'}}>{product.productName}</td>
                <td>{product.reviewType}</td>
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
                <td colSpan="6" style={{ padding: '50px', textAlign: 'center' }}>
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