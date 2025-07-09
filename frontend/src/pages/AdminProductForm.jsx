// src/pages/AdminProductForm.jsx (진행 상태 필드 추가)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from '../firebaseConfig';

const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];

const initialFormState = {
  productName: '',
  reviewType: '',
  guide: '',
  reviewDate: '',
  progressStatus: '진행전', // 기본값 '진행전'으로 설정
};

export default function AdminProductForm() {
  const { productId } = useParams();
  const isEditMode = Boolean(productId);

  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode);
  const navigate = useNavigate();

  useEffect(() => {
    if (isEditMode) {
      const fetchProductData = async () => {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          // progressStatus가 없는 기존 데이터를 위해 기본값 설정
          setForm({ ...initialFormState, ...docSnap.data() });
        } else {
          alert('해당 상품 정보를 찾을 수 없습니다.');
          navigate('/admin/products');
        }
        setLoading(false);
      };
      fetchProductData();
    }
  }, [isEditMode, productId, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productName || !form.reviewType || !form.reviewDate) {
      alert('상품명, 리뷰 종류, 진행일자는 필수 항목입니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      const dataToSave = { ...form };
      if (isEditMode) {
        const docRef = doc(db, 'products', productId);
        await updateDoc(docRef, dataToSave);
        alert('상품이 성공적으로 수정되었습니다.');
      } else {
        await addDoc(collection(db, 'products'), { ...dataToSave, createdAt: serverTimestamp() });
        alert('상품이 성공적으로 생성되었습니다.');
      }
      navigate('/admin/products');
    } catch (error) {
      alert(`오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <p>상품 정보를 불러오는 중...</p>;

  return (
    <>
      <h2>{isEditMode ? '상품 수정' : '상품 생성'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ▼▼▼ 진행 상태 필드 추가 ▼▼▼ */}
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <label style={{ display: 'inline-block', width: '100px' }}>진행 상태</label>
          <select name="progressStatus" value={form.progressStatus} onChange={handleChange} required style={{width: 'calc(100% - 120px)', padding: '8px'}}>
            {progressStatusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        {/* ▲▲▲ 진행 상태 필드 추가 ▲▲▲ */}

        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <label style={{ display: 'inline-block', width: '100px' }}>상품명</label>
          <input type="text" name="productName" value={form.productName} onChange={handleChange} placeholder="예: [헬로피기] 베이컨 500g" required style={{width: 'calc(100% - 120px)', padding: '8px'}}/>
        </div>

        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <label style={{ display: 'inline-block', width: '100px' }}>리뷰 종류</label>
          <input type="text" name="reviewType" value={form.reviewType} onChange={handleChange} placeholder="예: 구매리뷰(영수증)" required style={{width: 'calc(100% - 120px)', padding: '8px'}}/>
        </div>

        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <label style={{ display: 'inline-block', width: '100px' }}>진행일자</label>
          <input type="text" name="reviewDate" value={form.reviewDate} onChange={handleChange} placeholder="예: 7/10(수) ~ 7/12(금)" required style={{width: 'calc(100% - 120px)', padding: '8px'}}/>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px' }}>가이드</label>
          <textarea name="guide" value={form.guide} onChange={handleChange} placeholder="리뷰 작성 시 필요한 상세 안내 내용을 입력하세요." style={{ width: '100%', minHeight: '150px', padding: '8px' }}></textarea>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={() => navigate('/admin/products')} disabled={isSubmitting} style={{padding: '10px 20px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff'}}>닫기</button>
          <button type="submit" disabled={isSubmitting} style={{padding: '10px 20px', border: 'none', borderRadius: '4px', background: '#000', color: '#fff'}}>{isSubmitting ? '저장 중...' : (isEditMode ? '수정 완료' : '상품 등록')}</button>
        </div>
      </form>
    </>
  );
}