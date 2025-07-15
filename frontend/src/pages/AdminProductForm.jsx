// src/pages/AdminProductForm.jsx (수정 완료)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, collection, addDoc, serverTimestamp, updateDoc, doc, getDoc, writeBatch } from '../firebaseConfig';

const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];
const productTypeOptions = ['실배송', '빈박스'];
const reviewTypeOptions = ['현영', '자율결제'];
const fullReviewOptions = ['별점', '텍스트', '포토', '프리미엄포토', '프리미엄영상'];
const limitedReviewOptions = ['별점', '텍스트'];

// [수정] 링크 템플릿을 상수로 관리하여 유지보수 용이성 확보
const REVIEW_LINK_PLACEHOLDER = '[[리뷰링크]]';
const REVIEW_LINK_BASE_URL = 'https://hellopiggys.netlify.app/link?pid=';

const initialFormState = {
  productName: '', reviewType: '현영',
  // [수정] 가이드 내용에 플레이스홀더 추가
  guide: `✅ 리뷰 인증 페이지!\n- ${REVIEW_LINK_PLACEHOLDER}\n\n현영(지출증빙): 736-28-00836, 7362800836\n🚫상품명 검색 금지🚫\n🚫타계 동일 연락처, 동일 주소 중복 불가🚫\n🚫여러 상품 진행 시 장바구니 결제🚫\n✅키워드 검색 후 (가격 검색 필수) [찜🩷]\n + 체류 2분 후 [장바구니🛒] > [바로구매] \n\n⚠ 가이드의 상품 옵션 그대로 구매 진행 \n⚠ 옵션 변경 시 페이백 불가 \n\n✅리뷰 가이드🙇 📸 포토 리뷰(포토 3장 + 텍스트 3줄 이상 + 별점 5점) \n\n✅구매 후 업로드!\n - 구매 인증 시 상품명, 옵션 확인 안될 경우 페이백 불가\n - 현금영수증(지출증빙) 7362800836 입력 인증 필수! \n\n✅ 페이백 - 리뷰 인증 확인 후 48시간 이내 페이백 (입금자명 : 강예슬)\n - 페이백 확인이 안될 경우 개인톡❌\n - 1:1 문의방으로 문의해 주세요\n  → https://open.kakao.com/o/sscJn3wh\n - 입장 후 구매일자, 구매상품을 말씀해 주시면 더 빠른 확인이 가능해요!`,
  reviewDate: '', progressStatus: '진행중', productType: '실배송', reviewOption: '포토',
};

export default function AdminProductFormPage() {
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
          const data = docSnap.data();
          // [수정] 불러온 데이터의 가이드에 링크가 없으면 새로 생성해서 채워줌
          if (data.guide && !data.guide.includes(REVIEW_LINK_BASE_URL)) {
              data.guide = data.guide.replace(REVIEW_LINK_PLACEHOLDER, REVIEW_LINK_BASE_URL + productId)
          }
          setForm({ ...initialFormState, ...data });
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
    if (name === 'productType') {
      setForm(prev => ({ ...prev, productType: value, reviewOption: '별점' }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productName || !form.reviewType || !form.reviewDate) {
      alert('상품명, 결제 종류, 진행일자는 필수 항목입니다.');
      return;
    }
    setIsSubmitting(true);
    
    // [수정] 가이드에 링크를 삽입하는 로직
    let finalGuide = form.guide || '';
    const linkToInsert = isEditMode ? REVIEW_LINK_BASE_URL + productId : ''; // 수정 모드일 때의 링크

    try {
      if (isEditMode) {
        // 수정 모드: [[리뷰링크]]를 실제 링크로 교체
        finalGuide = finalGuide.replace(REVIEW_LINK_PLACEHOLDER, linkToInsert);
        const productRef = doc(db, 'products', productId);
        await updateDoc(productRef, { ...form, guide: finalGuide });
        alert('상품이 성공적으로 수정되었습니다.');
      } else {
        // 생성 모드: ID를 먼저 만들고, 그 ID로 링크를 만든 후 데이터 저장
        const newProductRef = doc(collection(db, 'products'));
        const newProductId = newProductRef.id;
        const newProductLink = REVIEW_LINK_BASE_URL + newProductId;
        finalGuide = finalGuide.replace(REVIEW_LINK_PLACEHOLDER, newProductLink);
        
        await addDoc(collection(db, 'products'), { 
            ...form, 
            guide: finalGuide,
            createdAt: serverTimestamp() 
        });
        alert('상품이 성공적으로 생성되었습니다.');
      }
      navigate('/admin/products');
    } catch (error) {
      alert(`오류가 발생했습니다: ${error.message}`);
      console.error("Error saving product: ", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <p>상품 정보를 불러오는 중...</p>;
  const currentReviewOptions = form.productType === '빈박스' ? limitedReviewOptions : fullReviewOptions;

  return (
    <>
      <h2>{isEditMode ? '상품 수정' : '상품 생성'}</h2>
      <form onSubmit={handleSubmit} className="product-form">
        <div className="form-field"><label>진행 상태</label><select name="progressStatus" value={form.progressStatus} onChange={handleChange} required>{progressStatusOptions.map(s => (<option key={s} value={s}>{s}</option>))}</select></div>
        <div className="form-field"><label>상품명</label><input type="text" name="productName" value={form.productName} onChange={handleChange} placeholder="예: [헬로피기] 베이컨 500g" required /></div>
        <div className="form-field"><label>결제 종류</label><select name="reviewType" value={form.reviewType} onChange={handleChange} required>{reviewTypeOptions.map(t => (<option key={t} value={t}>{t}</option>))}</select></div>
        <div className="form-field"><label>상품 종류</label><select name="productType" value={form.productType} onChange={handleChange} required>{productTypeOptions.map(t => (<option key={t} value={t}>{t}</option>))}</select></div>
        <div className="form-field"><label>리뷰 종류</label><select name="reviewOption" value={form.reviewOption} onChange={handleChange} required>{currentReviewOptions.map(o => (<option key={o} value={o}>{o}</option>))}</select></div>
        <div className="form-field"><label>진행일자</label><input type="date" name="reviewDate" value={form.reviewDate} onChange={handleChange} required /></div>
        <div><label style={{ display: 'block', marginBottom: '8px' }}>가이드</label><textarea name="guide" value={form.guide} onChange={handleChange} placeholder="리뷰 작성 시 필요한 상세 안내 내용을 입력하세요." style={{ width: '100%', minHeight: '300px' }}></textarea></div>
        <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? '저장 중...' : (isEditMode ? '수정 완료' : '상품 등록')}</button>
            <button type="button" onClick={() => navigate('/admin/products')} disabled={isSubmitting}>닫기</button>
        </div>
      </form>
    </>
  );
}