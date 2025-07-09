// src/pages/WriteReview.jsx (오류 수정 최종본)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  auth, onAuthStateChanged, db, getStorageInstance, 
  ref, uploadBytes, getDownloadURL, addDoc, collection, 
  serverTimestamp, getDocs, query, orderBy, where 
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import AccountModal from '../components/AccountModal';
import './WriteReview.css';
import imageCompression from 'browser-image-compression';

// 업로드 필드 정의 (handleSubmit에서 사용)
const UPLOAD_FIELDS = [
  // 'keywordImage'와 'likeImage'를 'keywordAndLikeImages'로 통합
  { key: 'keywordAndLikeImages', label: '1. 키워드 & 찜 인증', group: 'keyword-like' },
  { key: 'orderImage', label: '구매 인증', group: 'purchase' },
  { key: 'cashcardImage', label: '현금영수증/매출전표', group: 'purchase' },
];

export default function WriteReview() {
  const navigate = useNavigate();
  const storage = getStorageInstance();

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  
  const [form, setForm] = useState({
    participantId: '', orderNumber: '', rewardAmount: '', subAccountId: null,
  });
  
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [isAccountSelected, setIsAccountSelected] = useState(false);
  const [selectedSubAccountInfo, setSelectedSubAccountInfo] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) { setSelectedProduct(null); setIsAccountSelected(false); }
    });
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), where('progressStatus', '==', '진행중'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) { console.error("상품 목록 로딩 실패:", e); } 
      finally { setLoading(false); }
    };
    fetchProducts();
    return () => unsubscribeAuth();
  }, []);

  const onFileChange = async (e) => { // async로 변경
    const { name, files } = e.target;
    if (!files || files.length === 0) return;
  
    const options = {
      maxSizeMB: 1, // 이미지 최대 용량 (1MB)
      maxWidthOrHeight: 1920, // 최대 해상도
      useWebWorker: true,
    };
  
    try {
      const compressedFiles = [];
      for (const file of files) {
        console.log(`압축 전: ${file.name}, ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        const compressedFile = await imageCompression(file, options);
        console.log(`압축 후: ${compressedFile.name}, ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        compressedFiles.push(compressedFile);
      }
      
      const selectedFiles = compressedFiles.slice(0, 5);
      setImages(prev => ({ ...prev, [name]: selectedFiles }));
      const previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => ({ ...prev, [name]: previewUrls }));
  
    } catch (error) {
      console.error('이미지 압축 실패:', error);
      alert('이미지 처리 중 오류가 발생했습니다. 다른 사진을 선택해주세요.');
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedProduct || !form.subAccountId) {
      return alert('로그인, 상품 선택, 계정 선택이 모두 완료되어야 합니다.');
    }
    setSubmitting(true);
    try {
      const urlMap = {};

      // [변경 전] Promise.all을 사용한 동시 업로드 방식
      /*
      const uploadPromises = [];
      for (const field of UPLOAD_FIELDS) { ... }
      await Promise.all(uploadPromises);
      */

      // [변경 후] for...of 루프를 사용한 순차 업로드 방식
      for (const field of UPLOAD_FIELDS) {
        const fieldName = field.key;
        if (images[fieldName] && images[fieldName].length > 0) {
          const urls = [];
          for (const file of images[fieldName]) {
            console.log(`Uploading ${file.name} for ${fieldName}...`); // 진행 상황 확인용 로그
            const storageRef = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            urls.push(downloadUrl);
            console.log(`... ${file.name} upload complete.`);
          }
          urlMap[`${fieldName}Urls`] = urls;
        }
      }
      // ▲▲▲ 순차 업로드 로직으로 변경 완료 ▲▲▲

      const reviewData = {
        mainAccountId: currentUser.uid, subAccountId: form.subAccountId,
        productId: selectedProduct.id, productName: selectedProduct.productName,
        reviewType: selectedProduct.reviewType, createdAt: serverTimestamp(),
        status: 'submitted', orderNumber: form.orderNumber,
        rewardAmount: form.rewardAmount, participantId: form.participantId,
        ...urlMap,
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      alert('리뷰가 성공적으로 제출되었습니다.');
      navigate('/my-reviews', { replace: true });
    } catch (err) {
      alert('제출 실패: ' + err.message);
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMainButtonClick = () => { if (currentUser) { if (selectedProduct) { setIsAccountModalOpen(true); } else { alert("먼저 참여할 상품을 선택해주세요."); } } else { setIsLoginModalOpen(true); } };
  const handleLoginSuccess = () => setIsLoginModalOpen(false);
  const handleProductSelect = (e) => { const productId = e.target.value; const product = products.find(p => p.id === productId) || null; setSelectedProduct(product); setIsAccountSelected(false); };
  const handleSelectAccount = (subAccount) => { setForm(prev => ({ ...prev, subAccountId: subAccount.id })); setSelectedSubAccountInfo(subAccount); setIsAccountSelected(true); setIsAccountModalOpen(false); };
  const onFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  if (loading) return <p style={{textAlign: 'center', padding: '50px'}}>페이지 정보를 불러오는 중...</p>;

  return (
    <div className="page-wrap">
      <h2 className="title">구매 폼 작성</h2>
      {!currentUser && ( <div className="notice-box">로그인 후 배정받은 상품을 선택해주세요.</div> )}
      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />}
      {currentUser ? (<button onClick={() => auth.signOut()} className="logout-btn" style={{marginBottom: '20px'}}>로그아웃</button>) : (<button onClick={() => setIsLoginModalOpen(true)} style={{marginBottom: '20px'}}>로그인 / 회원가입</button>)}
      {currentUser && (
        <div className="field">
          <label>상품 선택</label>
          <select onChange={handleProductSelect} value={selectedProduct?.id || ''}>
            <option value="" disabled>배정받은 상품을 선택하세요</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.productName} ({p.reviewType})</option>)}
          </select>
        </div>
      )}
      {selectedProduct && (<>
          <div className="product-info-box"><h4>{selectedProduct.productName}</h4><p><strong>리뷰 종류:</strong> {selectedProduct.reviewType}</p><p><strong>진행 일자:</strong> {selectedProduct.reviewDate}</p>{selectedProduct.guide && (<div className="guide-content"><strong>가이드:</strong><p style={{whiteSpace: 'pre-line'}}>{selectedProduct.guide}</p></div>)}</div>
          <div className="account-actions"><button type="button" onClick={handleMainButtonClick}>{isAccountSelected ? '✓ 계정 선택 완료 (변경하기)' : '구매/리뷰 진행 계정 선택'}</button></div>
          {isAccountModalOpen && <AccountModal onClose={() => setIsAccountModalOpen(false)} onSelectAccount={handleSelectAccount}/>}
      </>)}
      
      {isAccountSelected && selectedSubAccountInfo && (
        <form onSubmit={handleSubmit}>
          {[ { key: 'name', label: '구매자(수취인)', value: selectedSubAccountInfo.name }, { key: 'phoneNumber', label: '전화번호', value: selectedSubAccountInfo.phoneNumber }, { key: 'address', label: '주소', value: selectedSubAccountInfo.address }, { key: 'bank', label: '은행', value: selectedSubAccountInfo.bank }, { key: 'bankNumber', label: '계좌번호', value: selectedSubAccountInfo.bankNumber }, { key: 'accountHolderName', label: '예금주', value: selectedSubAccountInfo.accountHolderName }, ].map(({ key, label, value }) => (<div className="field" key={key}><label>{label}</label><input value={value || ''} readOnly style={{background: '#f0f0f0', cursor: 'not-allowed'}}/></div>))}
          {[ { key: 'participantId', label: '참가자 ID', ph: '참가자 ID를 입력하세요' }, { key: 'orderNumber', label: '주문번호', ph: '주문번호를 그대로 복사하세요' }, { key: 'rewardAmount', label: '금액', ph: '결제금액을 입력하세요' }, ].map(({ key, label, ph }) => (<div className="field" key={key}><label>{label}</label><input name={key} value={form[key]} onChange={onFormChange} placeholder={ph} required/></div>))}

          {/* ▼▼▼ 이미지 업로드 UI 수정 ▼▼▼ */}
          <div className="image-upload-group">
            {/* 키워드 & 찜 인증 그룹 */}
            {UPLOAD_FIELDS.filter(f => f.group === 'keyword-like').map(({ key, label }) => (
              <div className="field" key={key}>
                {/* label을 필드 정의에서 가져옵니다 */}
                <label>{label} (최대 5장)</label>
                {/* name을 통합된 key로 사용합니다 */}
                <input type="file" accept="image/*" name={key} onChange={onFileChange} multiple required />
                <div className="preview-container">
                  {previews[key] && previews[key].map((src, i) => <img key={i} className="thumb" src={src} alt={`${label} ${i+1}`} />)}
                </div>
              </div>
            ))}
          </div>

          <div className="image-upload-group">
            <h4>2. 구매 & 증빙 인증</h4>
            {UPLOAD_FIELDS.filter(f => f.group === 'purchase').map(({ key, label }) => (
              <div className="field" key={key}>
                <label>{label} (최대 5장)</label>
                <input type="file" accept="image/*" name={key} onChange={onFileChange} multiple required />
                <div className="preview-container">
                  {previews[key] && previews[key].map((src, i) => <img key={i} className="thumb" src={src} alt={`${label} ${i+1}`} />)}
                </div>
              </div>
            ))}
          </div>
          {/* ▲▲▲ 이미지 업로드 UI 수정 ▲▲▲ */}

          <div className="field"><label><input type="checkbox" required /> 개인정보 이용에 동의합니다.</label></div>
          <button className="submit-btn" type="submit" disabled={submitting}>{submitting ? '제출하기' : '제출 중…'}</button>
        </form>
      )}
    </div>
  );
}
