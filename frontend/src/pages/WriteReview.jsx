// src/pages/WriteReview.jsx

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
  { key: 'keywordAndLikeImages', label: '1. 키워드 & 찜 인증', group: 'keyword-like', required: false },
  { key: 'orderImage', label: '구매 인증', group: 'purchase', required: false },
  { key: 'cashcardImage', label: '현금영수증/매출전표', group: 'purchase', required: false },
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
    participantId: '',
    orderNumber: '',
    rewardAmount: '',
    subAccountId: null,
    name: '',
    phoneNumber: '',
    address: '',
    bank: '',
    bankNumber: '',
    accountHolderName: '',
    paymentType: '현영',
    productType: '실배송',
    reviewOption: '별점',
  });
  const [addressOptions, setAddressOptions] = useState([]);
  const [globalAddresses, setGlobalAddresses] = useState([]);
  
  const [images, setImages] = useState({});
  const [previews, setPreviews] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [isAccountSelected, setIsAccountSelected] = useState(false);
  const [selectedSubAccountInfo, setSelectedSubAccountInfo] = useState(null);
  const [isAgreed, setIsAgreed] = useState(false);

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
    const fetchAddresses = async () => {
      try {
        const snap = await getDocs(collection(db, 'addresses'));
        setGlobalAddresses(snap.docs.map(d => d.data().value));
      } catch (e) { console.error('주소 목록 로딩 실패:', e); }
    };
    fetchProducts();
    fetchAddresses();
    return () => unsubscribeAuth();
  }, []);

  // ▼▼▼ onFileChange 함수 수정 (압축 실패 시 원본 파일 사용) ▼▼▼
  const onFileChange = async (e) => {
    const { name, files } = e.target;
    if (!files || files.length === 0) return;
  
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    };
  
    // 압축된 파일 또는 원본 파일을 담을 배열
    const processedFiles = [];
  
    for (const file of files) {
      try {
        // 1. 이미지 압축 시도
        const compressedFile = await imageCompression(file, options);
        processedFiles.push(compressedFile);
      } catch (error) {
        // 2. 압축 실패 시, 콘솔에 경고를 남기고 원본 파일을 그대로 사용
        console.warn(`이미지 압축 실패. 원본 파일을 사용합니다: ${file.name}`, error);
        processedFiles.push(file);
      }
    }
    
    // 처리된 파일들로 상태 업데이트 (압축 성공/실패 여부와 관계없이 진행)
    const selectedFiles = processedFiles.slice(0, 5);
    setImages(prev => ({ ...prev, [name]: selectedFiles }));
    
    const previewUrls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => ({ ...prev, [name]: previewUrls }));
  };
  // ▲▲▲ 수정 완료 ▲▲▲
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      return alert('필수 입력 항목을 모두 채워주세요.');
    }
    setSubmitting(true);
    try {
      const urlMap = {};

      for (const field of UPLOAD_FIELDS) {
        const fieldName = field.key;
        if (images[fieldName] && images[fieldName].length > 0) {
          const urls = [];
          for (const file of images[fieldName]) {
            const storageRef = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            urls.push(downloadUrl);
          }
          urlMap[`${fieldName}Urls`] = urls;
        }
      }

      const reviewData = {
        mainAccountId: currentUser.uid,
        subAccountId: form.subAccountId,
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        reviewType: selectedProduct.reviewType,
        createdAt: serverTimestamp(),
        status: 'submitted',
        name: form.name,
        phoneNumber: form.phoneNumber,
        address: form.address,
        bank: form.bank,
        bankNumber: form.bankNumber,
        accountHolderName: form.accountHolderName,
        orderNumber: form.orderNumber,
        rewardAmount: form.rewardAmount,
        participantId: form.participantId,
        paymentType: form.paymentType,
        productType: form.productType,
        reviewOption: form.reviewOption,
        ...urlMap,
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      const uploadedAllImages = UPLOAD_FIELDS.every(f => images[f.key] && images[f.key].length > 0);
      const msg = uploadedAllImages
        ? '리뷰가 성공적으로 제출되었습니다.'
        : '리뷰가 성공적으로 제출되었습니다.\nhttps://hellopiggy.netlify.app/my-reviews 에서 이미지 등록을 완료해주셔야 구매인증이 완료됩니다.';
      alert(msg);
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
  const handleSelectAccount = (subAccount) => {
    setForm(prev => ({
      ...prev,
      subAccountId: subAccount.id,
      name: subAccount.name || '',
      phoneNumber: subAccount.phoneNumber || '',
      address: (subAccount.addresses && subAccount.addresses[0]) || subAccount.address || '',
      bank: subAccount.bank || '',
      bankNumber: subAccount.bankNumber || '',
      accountHolderName: subAccount.accountHolderName || ''
    }));
    const subAddrs = subAccount.addresses || (subAccount.address ? [subAccount.address] : []);
    const allAddrs = Array.from(new Set([...globalAddresses, ...subAddrs]));
    setAddressOptions(allAddrs);
    setSelectedSubAccountInfo(subAccount);
    setIsAccountSelected(true);
    setIsAccountModalOpen(false);
  };

  const onFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'orderNumber' || name === 'rewardAmount' || name === 'phoneNumber' || name === 'bankNumber') {
      const numericValue = value.replace(/[^0-9]/g, '');
      setForm({ ...form, [name]: numericValue });
    } else if (name === 'productType') {
      setForm({ ...form, productType: value, reviewOption: '별점' });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const isFormValid =
    isAccountSelected &&
    form.participantId.trim() !== '' &&
    form.orderNumber.trim() !== '' &&
    form.rewardAmount.trim() !== '' &&
    isAgreed;

  if (loading) return <p style={{textAlign: 'center', padding: '50px'}}>페이지 정보를 불러오는 중...</p>;

  return (
    <div className="page-wrap">
      <h2 className="title">구매 폼 작성</h2>
      {!currentUser && ( 
        <div className="notice-box">
        로그인 후 배정받은 상품을 선택해주세요.<br />
        회원가입 시 전화번호는 숫자만 입력하세요.<br /><br />
        회원가입은 지금 본인 이름과 전화번호로 가입하시고<br />
        계정 추가 시 실제 진행 계정을 입력하셔서 등록하세요.<br />
        * 타계정도 본인 이름과 전화번호로 가입하셔야합니다. *<br />
        지금 가입하시는 하나의 이름과 전화번호로 전부 관리하는겁니다.
        </div> )}
      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />}
      {currentUser ? (
        <button onClick={() => auth.signOut()} className="logout-btn">로그아웃</button>
      ) : (
        <button onClick={() => setIsLoginModalOpen(true)} className="login-open-btn">로그인 / 회원가입</button>
      )}
      {currentUser && (
        <div className="field">
          <label>상품 선택</label>
          <select onChange={handleProductSelect} value={selectedProduct?.id || ''}>
            <option value="" disabled>체험단 상품을 선택해 주세요</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.productName} ({p.reviewType})</option>)}
          </select>
        </div>
      )}
      {selectedProduct && (<>
          <div className="product-info-box"><h4>{selectedProduct.productName}</h4><p><strong>결제 종류:</strong> {selectedProduct.reviewType}</p><p><strong>진행 일자:</strong> {selectedProduct.reviewDate}</p>{selectedProduct.guide && (<div className="guide-content"><strong>가이드:</strong><p style={{whiteSpace: 'pre-line'}}>{selectedProduct.guide}</p></div>)}</div>
          <div className="account-actions"><button type="button" onClick={handleMainButtonClick}>{isAccountSelected ? '✓ 계정 선택 완료 (변경하기)' : '구매 폼 작성하기'}</button></div>
          {isAccountModalOpen && (
            <AccountModal
              onClose={() => setIsAccountModalOpen(false)}
              onSelectAccount={handleSelectAccount}
              onAddressAdded={(addr) =>
                setGlobalAddresses(prev => Array.from(new Set([...prev, addr])))
              }
            />
          )}
      </>)}
      
      {isAccountSelected && selectedSubAccountInfo && (
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>구매자(수취인)</label>
            <input name="name" value={form.name} onChange={onFormChange} required />
          </div>
          <div className="field">
            <label>전화번호</label>
            <input name="phoneNumber" value={form.phoneNumber} onChange={onFormChange} required />
          </div>
          <div className="field">
            <label>주소</label>
            {addressOptions.length > 0 ? (
              <select name="address" value={form.address} onChange={onFormChange} required>
                {addressOptions.map((addr, idx) => (
                  <option key={idx} value={addr}>{addr}</option>
                ))}
              </select>
            ) : (
              <input name="address" value={form.address} onChange={onFormChange} required />
            )}
          </div>
          <div className="field">
            <label>은행</label>
            <input name="bank" value={form.bank} onChange={onFormChange} required />
          </div>
          <div className="field">
            <label>계좌번호</label>
            <input name="bankNumber" value={form.bankNumber} onChange={onFormChange} required />
          </div>
          <div className="field">
            <label>예금주</label>
            <input name="accountHolderName" value={form.accountHolderName} onChange={onFormChange} required />
          </div>
          
          <div className="field">
            <label>쿠팡 ID</label>
            <input name="participantId" value={form.participantId} onChange={onFormChange} placeholder="쿠팡 ID를 입력하세요" required/>
          </div>
          <div className="field">
            <label>주문번호</label>
            <input name="orderNumber" value={form.orderNumber} onChange={onFormChange} placeholder="주문번호를 그대로 복사하세요" required/>
          </div>
          <div className="field">
            <label>금액</label>
            <input
              name="rewardAmount"
              value={form.rewardAmount ? Number(form.rewardAmount).toLocaleString() : ''}
              onChange={onFormChange}
              placeholder="결제금액을 입력하세요"
              required
            />
          </div>
          <div className="field">
            <label>결제유형(선택하세요)</label>
            <select name="paymentType" value={form.paymentType} onChange={onFormChange}>
              <option value="현영">현영</option>
              <option value="자율결제">자율결제</option>
            </select>
          </div>
          <div className="field">
            <label>상품종류(선택하세요)</label>
            <select name="productType" value={form.productType} onChange={onFormChange}>
              <option value="실배송">실배송</option>
              <option value="빈박스">빈박스</option>
            </select>
          </div>
          <div className="field">
            <label>리뷰종류(선택하세요)</label>
            <select name="reviewOption" value={form.reviewOption} onChange={onFormChange}>
              {form.productType === '빈박스' ? (
                <>
                  <option value="별점">별점</option>
                  <option value="텍스트">텍스트</option>
                </>
              ) : (
                <>
                  <option value="별점">별점</option>
                  <option value="텍스트">텍스트</option>
                  <option value="포토">포토</option>
                  <option value="프리미엄포토">프리미엄포토</option>
                  <option value="프리미엄영상">프리미엄영상</option>
                </>
              )}
            </select>
          </div>
          
          <div className="image-upload-group">
            {UPLOAD_FIELDS.filter(f => f.group === 'keyword-like').map(({ key, label, required }) => (
              <div className="field" key={key}>
                <label>{label} (최대 5장)</label>
                <input type="file" accept="image/*" name={key} onChange={onFileChange} multiple />
                <div className="preview-container">
                  {previews[key] && previews[key].map((src, i) => <img key={i} className="thumb" src={src} alt={`${label} ${i+1}`} />)}
                </div>
              </div>
            ))}
          </div>

          <div className="image-upload-group">
            <h4>2. 구매 & 증빙 인증</h4>
            {UPLOAD_FIELDS.filter(f => f.group === 'purchase').map(({ key, label, required }) => (
              <div className="field" key={key}>
                <label>{label} (최대 5장)</label>
                <input type="file" accept="image/*" name={key} onChange={onFileChange} multiple />
                <div className="preview-container">
                  {previews[key] && previews[key].map((src, i) => <img key={i} className="thumb" src={src} alt={`${label} ${i+1}`} />)}
                </div>
              </div>
            ))}
          </div>
          
          <div className="field">
            <label>
              <input 
                type="checkbox" 
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
              /> 개인정보 이용에 동의합니다.
            </label>
          </div>
          <button 
            className="submit-btn" 
            type="submit" 
            disabled={!isFormValid || submitting}
          >
            {submitting ? '제출 중…' : '제출하기'}
          </button>
        </form>
      )}
    </div>
  );
}
