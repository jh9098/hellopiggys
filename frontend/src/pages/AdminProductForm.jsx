// src/pages/AdminProductForm.jsx (신규 파일)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from '../firebaseConfig';

const initialFormState = {
  productName: '',
  reviewType: '',
  guide: '',
  reviewDate: '',
};

export default function AdminProductForm() {
  const { productId } = useParams(); // URL에서 productId를 가져옵니다.
  const isEditMode = Boolean(productId); // productId가 있으면 수정 모드

  const [form, setForm] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode); // 수정 모드일 때만 초기에 로딩
  const navigate = useNavigate();

  // 수정 모드일 경우, 기존 데이터를 불러옵니다.
  useEffect(() => {
    if (isEditMode) {
      const fetchProductData = async () => {
        const docRef = doc(db, 'products', productId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setForm(docSnap.data());
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
      if (isEditMode) {
        // 수정 모드: 기존 문서를 업데이트합니다.
        const docRef = doc(db, 'products', productId);
        await updateDoc(docRef, {
          productName: form.productName,
          reviewType: form.reviewType,
          guide: form.guide,
          reviewDate: form.reviewDate,
        });
        alert('상품이 성공적으로 수정되었습니다.');
      } else {
        // 생성 모드: 새 문서를 추가합니다.
        await addDoc(collection(db, 'products'), {
          ...form,
          createdAt: serverTimestamp(),
        });
        alert('상품이 성공적으로 생성되었습니다.');
      }
      navigate('/admin/products');
    } catch (error) {
      alert(`오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <p>상품 정보를 불러오는 중...</p>;
  }

  return (
    <>
      <h2>{isEditMode ? '상품 수정' : '상품 생성'}</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
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
          <button type="button" onClick={() => navigate('/admin/products')} disabled={isSubmitting} style={{padding: '10px 20px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff'}}>
            닫기
          </button>
          <button type="submit" disabled={isSubmitting} style={{padding: '10px 20px', border: 'none', borderRadius: '4px', background: '#000', color: '#fff'}}>
            {isSubmitting ? '저장 중...' : (isEditMode ? '수정 완료' : '상품 등록')}
          </button>
        </div>
      </form>
    </>
  );
}