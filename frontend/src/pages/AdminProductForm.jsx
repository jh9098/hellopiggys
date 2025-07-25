// src/pages/AdminProductForm.jsx (수정 완료)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, collection, serverTimestamp, updateDoc, doc, getDoc, setDoc } from '../firebaseConfig';
import { Button } from '@/components/ui/button';

const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];
const productTypeOptions = ['실배송', '빈박스'];
const reviewTypeOptions = ['현영', '자율결제'];
const fullReviewOptions = ['별점', '텍스트', '포토', '프리미엄(포토)', '프리미엄(영상)'];
const limitedReviewOptions = ['별점', '텍스트'];

const reviewGuideMap = {
  '별점': '⭐ 별점 리뷰 : 별점 5점',
  '텍스트': '✍ 텍스트 리뷰 : 텍스트 3줄 이상 + 별점 5점',
  '포토': '📸 포토 리뷰 : 포토 3장 + 텍스트 3줄 이상 + 별점 5점',
  '프리미엄(포토)': '📸 프리미엄(포토) : 포토 10장 + 예쁜 텍스트 많이 / 풀-포리',
  '프리미엄(영상)': '📹 프리미엄(영상) : 영상 + 포토 10장 + 예쁜 텍스트 많이'
};

const buildReviewGuide = (option) => `- ${reviewGuideMap[option] || ''}`;

const REVIEW_GUIDE_REGEX = /- [\s\S]*?(?=\n✅구매 후 업로드!|$)/;

const REVIEW_LINK_PLACEHOLDER = '[[리뷰링크]]';
// ▼▼▼ "리뷰 링크"의 기본 URL을 새로운 경로로 수정합니다 ▼▼▼
const REVIEW_LINK_BASE_URL = 'https://hellopiggys.netlify.app/reviewer/link?pid=';
// ▲▲▲ 수정 완료 ▲▲▲

// 입력된 가이드에서 리뷰 링크 관련 줄을 제거합니다.
const removeReviewLinkLines = (text) =>
  text
    .split('\n')
    .filter(
      (line) =>
        !line.includes(REVIEW_LINK_BASE_URL) &&
        !line.includes(REVIEW_LINK_PLACEHOLDER)
    )
    .join('\n')
    .trim();

// 저장된 가이드에 편집 시 리뷰 링크 줄을 삽입합니다.
const insertReviewLink = (text, pid) => {
  const linkLine = `✅ 구매폼 작성\n- ${REVIEW_LINK_BASE_URL}${pid}\n\n`;
  if (text.includes(REVIEW_LINK_BASE_URL)) {
    return text.replace(/pid=[a-zA-Z0-9]+/, `pid=${pid}`);
  }
  if (text.includes(REVIEW_LINK_PLACEHOLDER)) {
    return text.replace(REVIEW_LINK_PLACEHOLDER, `${REVIEW_LINK_BASE_URL}${pid}`);
  }
  return linkLine + text;
};

// 키워드, 상품가격, 옵션 정보를 이용해 가이드 머리말을 생성합니다.
const buildGuideHeader = ({ keywords = '', productPrice = '', productOption = '' }) => {
  const price = productPrice ? `₩${Number(productPrice).toLocaleString()}` : '';
  return [
    `✅키워드 : ${keywords}`,
    `✅상품가격 : ${price}`,
    `✅옵션 : ${productOption}`,
    '',
    '⭐광고 구매 X / 광고로 구매하지 마세요⭐',
    '',
    '[찜🩷] > 체류 2분 이상 >  [장바구니/구매]' ,
    ''
  ].join('\n');
};

// 기존 가이드에서 머리말 부분을 제거합니다.
const removeGuideHeader = (text) => {
  const lines = text.split('\n');
  const isHeaderLine = (line) =>
    line.startsWith('✅키워드') ||
    line.startsWith('✅상품가격') ||
    line.startsWith('✅옵션') ||
    line.startsWith('⭐광고 구매') ||
    line.startsWith('[찜🩷]') ||
    line.trim() === '';
  while (lines.length && isHeaderLine(lines[0])) {
    lines.shift();
  }
  return lines.join('\n');
};

// 가이드 머리말을 삽입 또는 갱신합니다.
const upsertGuideHeader = (text, form) => {
  const header = buildGuideHeader(form);
  const body = removeGuideHeader(text);
  const newText = `${header}\n${body}`.trim();
  return newText;
};

const initialFormState = {
  productName: '', reviewType: '현영',
  guide: `✅ 구매폼 작성\n- ${REVIEW_LINK_PLACEHOLDER}\n\n현영(지출증빙): 736-28-00836, 7362800836\n🚫상품명 검색 금지🚫\n🚫타계 동일 연락처, 동일 주소 중복 불가🚫\n🚫여러 상품 진행 시 장바구니 결제🚫\n✅키워드 검색 후 [찜🩷]\n + 체류 2분 후 [장바구니🛒] > [바로구매] \n\n⚠ 가이드의 상품 옵션 그대로 구매 진행 \n⚠ 옵션 변경 시 페이백 불가 \n\n✅리뷰 가이드🙇\n${buildReviewGuide('포토')}\n\n✅구매 후 업로드!\n - 구매 인증 시 상품명, 옵션 확인 안될 경우 페이백 불가\n - 현금영수증(지출증빙) 7362800836 입력 인증 필수! \n\n✅ 페이백 - 리뷰 인증 확인 후 48시간 이내 페이백 (입금자명 : 강예슬)\n - 페이백 확인이 안될 경우 개인톡❌\n - 1:1 문의방으로 문의해 주세요\n  → https://open.kakao.com/o/sscJn3wh\n - 입장 후 구매일자, 구매상품을 말씀해 주시면 더 빠른 확인이 가능해요!`,
  reviewDate: new Date().toISOString().slice(0, 10),
  progressStatus: '진행중',
  productType: '실배송',
  reviewOption: '포토',
  quantity: '',
  productOption: '',
  productPrice: '',
  keywords: '',
  productUrl: '',
  campaignId: '' // 연동할 캠페인 ID (선택)
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
          const withHeader = upsertGuideHeader(data.guide || '', data);
          const guideWithLink = insertReviewLink(withHeader, productId);
          setForm({ ...initialFormState, ...data, guide: guideWithLink });
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
    } else if (name === 'quantity' || name === 'productPrice') {
      setForm(prev => ({ ...prev, [name]: value ? Number(value) : '' }));
    } else {
      setForm(prev => ({ ...prev, [name]: value }));
    }
  };

  // 키 필드 변경 시 가이드 머리말을 최신 정보로 갱신합니다.
  useEffect(() => {
    if (!form.keywords && !form.productPrice && !form.productOption) return;
    setForm(prev => {
      const updated = upsertGuideHeader(prev.guide, prev);
      return updated === prev.guide ? prev : { ...prev, guide: updated };
    });
  }, [form.keywords, form.productPrice, form.productOption]);

  // 리뷰 종류 변경 시 해당 가이드 문구를 반영합니다.
  useEffect(() => {
    setForm(prev => {
      if (!prev.guide) return prev;
      const updated = prev.guide.replace(REVIEW_GUIDE_REGEX, buildReviewGuide(prev.reviewOption));
      return updated === prev.guide ? prev : { ...prev, guide: updated };
    });
  }, [form.reviewOption]);

  const loadCampaignData = async () => {
    if (!form.campaignId) return;
    try {
      const snap = await getDoc(doc(db, 'campaigns', form.campaignId));
      if (!snap.exists()) return alert('캠페인을 찾을 수 없습니다.');
      const data = snap.data();
      setForm(prev => ({
        ...prev,
        productName: data.productName || '',
        productType: data.deliveryType || '실배송',
        reviewOption: data.reviewType || '별점',
        quantity: data.quantity || '',
        productOption: data.productOption || '',
        productPrice: data.productPrice || '',
        keywords: data.keywords || '',
        productUrl: data.productUrl || '',
        reviewDate: data.date?.seconds ?
          new Date(data.date.seconds * 1000).toISOString().slice(0,10) : prev.reviewDate,
        progressStatus: '진행전'
      }));
    } catch (err) {
      console.error('캠페인 로드 실패:', err);
      alert('캠페인 정보를 불러오지 못했습니다.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.productName || !form.reviewType || !form.reviewDate) {
      alert('상품명, 결제 종류, 진행일자는 필수 항목입니다.');
      return;
    }
    setIsSubmitting(true);
    
    try {
      if (isEditMode) {
        const productRef = doc(db, 'products', productId);
        const withHeader = upsertGuideHeader(form.guide, form);
        const cleanedGuide = removeReviewLinkLines(withHeader);

        const { campaignId, ...updateData } = form;
        await updateDoc(productRef, { ...updateData, guide: cleanedGuide });
        alert('상품이 성공적으로 수정되었습니다.');
      } else {
        const newProductRef = doc(collection(db, 'products'));
        const newProductId = newProductRef.id;
        const withHeader = upsertGuideHeader(form.guide, form);
        const cleanedGuide = removeReviewLinkLines(withHeader);

        const { campaignId, ...productData } = form;
        await setDoc(newProductRef, {
            ...productData,
            guide: cleanedGuide,
            createdAt: serverTimestamp()
        });

        if (form.campaignId) {
          try {
            await updateDoc(doc(db, 'campaigns', form.campaignId), {
              productId: newProductId,
              status: '예약 확정',
              depositConfirmed: true,
              confirmedAt: serverTimestamp()
            });
          } catch (err) {
            console.error('캠페인 연동 실패:', err);
          }
        }
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
        <div className="form-field"><label>체험단 개수</label><input type="number" name="quantity" value={form.quantity} onChange={handleChange} /></div>
        <div className="form-field"><label>옵션</label><input type="text" name="productOption" value={form.productOption} onChange={handleChange} /></div>
        <div className="form-field"><label>상품가</label><input type="number" name="productPrice" value={form.productPrice} onChange={handleChange} /></div>
        <div className="form-field"><label>키워드</label><input type="text" name="keywords" value={form.keywords} onChange={handleChange} /></div>
        <div className="form-field"><label>상품 URL</label><input type="text" name="productUrl" value={form.productUrl} onChange={handleChange} /></div>
        <div className="form-field">
          <label>연동 캠페인 ID (선택)</label>
          <div style={{display:'flex', gap:'8px'}}>
            <input type="text" name="campaignId" value={form.campaignId} onChange={handleChange} placeholder="캠페인 문서 ID" />
            <Button type="button" onClick={loadCampaignData} disabled={!form.campaignId || isSubmitting}>가져오기</Button>
          </div>
        </div>
        <div><label style={{ display: 'block', marginBottom: '8px' }}>가이드</label><textarea name="guide" value={form.guide} onChange={handleChange} placeholder="리뷰 작성 시 필요한 상세 안내 내용을 입력하세요." style={{ width: '100%', minHeight: '300px' }}></textarea></div>
        <div className="form-actions">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? '저장 중...' : (isEditMode ? '수정 완료' : '상품 등록')}</Button>
            <Button type="button" onClick={() => navigate('/admin/products')} disabled={isSubmitting} variant="secondary">닫기</Button>
        </div>
      </form>
    </>
  );
}
