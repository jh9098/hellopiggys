// src/pages/WriteReview.jsx (개선안)

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  auth, onAuthStateChanged, db, storage, 
  ref, uploadBytes, getDownloadURL, addDoc, collection, doc, getDoc,
  serverTimestamp, getDocs, query, orderBy, where, updateDoc
} from '../firebaseConfig';
import LoginModal from '../components/LoginModal';
import AccountModal from '../components/AccountModal';
import './WriteReview.css';
import imageCompression from 'browser-image-compression';
// --- shadcn/ui 컴포넌트 임포트 ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UPLOAD_FIELDS = [
  { key: 'keywordAndLikeImages', label: '1. 키워드 & 찜 인증', group: 'keyword-like', required: false },
  { key: 'orderImage', label: '구매 인증', group: 'purchase', required: false },
  { key: 'cashcardImage', label: '현금영수증/매출전표', group: 'purchase', required: false },
];

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function WriteReview() {
  const navigate = useNavigate();
  const queryParams = useQuery();
  const productIdFromUrl = queryParams.get('pid');

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
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
  // ▼▼▼ [추가] 이미지 처리 상태를 관리할 state ▼▼▼
  const [imageProcessingStatus, setImageProcessingStatus] = useState({});
  // ▲▲▲ [추가] 완료 ▲▲▲

  const [showImageUpload, setShowImageUpload] = useState(false);

  // ▼▼▼ [수정] 제출 상태를 더 상세하게 관리하기 위한 state 추가 ▼▼▼
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState('');
  // ▲▲▲ [수정] 완료 ▲▲▲

  const [isAccountSelected, setIsAccountSelected] = useState(false);
  const [selectedSubAccountInfo, setSelectedSubAccountInfo] = useState(null);
  const [isAgreed, setIsAgreed] = useState(false);

  const filteredProducts = products.filter(p =>
    p.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    if (isAccountModalOpen || isLoginModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isAccountModalOpen, isLoginModalOpen]);

  const fetchAddresses = async (uid) => {
    if (!uid) return;
    try {
      const q = query(collection(db, 'addresses'), where('mainAccountId', '==', uid));
      const snap = await getDocs(q);
      setGlobalAddresses(snap.docs.map(d => d.data().value));
    } catch (e) { console.error('주소 목록 로딩 실패:', e); }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        fetchAddresses(user.uid);
      } else {
        setSelectedProduct(null);
        setIsAccountSelected(false);
        setGlobalAddresses([]);
      }
    });

    const initializeProducts = async () => {
      setLoading(true);
      if (productIdFromUrl) {
        const productRef = doc(db, 'products', productIdFromUrl);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const productData = { id: productSnap.id, ...productSnap.data() };
          setSelectedProduct(productData);
          setForm(prev => ({
            ...prev,
            paymentType: productData.reviewType || '현영',
            productType: productData.productType || '실배송',
            reviewOption: productData.reviewOption || '별점',
          }));
        } else {
          alert('유효하지 않은 상품 링크입니다. 관리자에게 문의하세요.');
        }
      } else {
        try {
          const q = query(collection(db, 'products'), where('progressStatus', '==', '진행중'), orderBy('createdAt', 'desc'));
          const snapshot = await getDocs(q);
          setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (e) {
          console.error("상품 목록 로딩 실패:", e);
        }
      }
      setLoading(false);
    };

    initializeProducts();
    return () => unsubscribeAuth();
  }, [productIdFromUrl]);

  // ▼▼▼ [수정] onFileChange 함수에 처리 중 상태 로직 추가 ▼▼▼
  const onFileChange = async (e) => {
    const { name, files } = e.target;
    if (!files || files.length === 0) return;

    // 1. 파일 선택 즉시 처리 중 상태로 변경
    setImageProcessingStatus(prev => ({ ...prev, [name]: true }));

    try {
      const options = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        initialQuality: 0.7,
      };
    
      const processedFiles = [];
      // for-of 루프는 await를 순차적으로 기다려줍니다.
      for (const file of files) {
        try {
          const compressedFile = await imageCompression(file, options);
          processedFiles.push(compressedFile);
        } catch (error) {
          console.warn(`이미지 압축 실패. 원본 파일을 사용합니다: ${file.name}`, error);
          processedFiles.push(file);
        }
      }
      
      const selectedFiles = Array.from(processedFiles).slice(0, 5);
      // 2. 압축 완료 후, state에 파일 목록 업데이트
      setImages(prev => ({ ...prev, [name]: selectedFiles }));

    } catch (err) {
      console.error("이미지 처리 중 오류 발생:", err);
      alert("이미지를 처리하는 중 오류가 발생했습니다. 다른 파일을 선택해보세요.");
    } finally {
      // 3. 성공/실패 여부와 관계없이 처리 중 상태 해제
      setImageProcessingStatus(prev => ({ ...prev, [name]: false }));
    }
  };
  // ▲▲▲ [수정] 완료 ▲▲▲
  
  // ▼▼▼ [수정] 제출 로직을 사용자 피드백과 안정성을 강화하는 방향으로 대폭 수정 ▼▼▼
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedProduct) {
      alert('오류: 상품이 선택되지 않았습니다. 페이지를 새로고침하고 다시 시도해주세요.');
      return;
    }
    if (!isFormValid) {
      alert('필수 입력 항목을 모두 채워주세요.');
      return;
    }

    setSubmitting(true);
    setSubmissionStatus('리뷰 정보 저장 중...');

    // --- 1단계: 텍스트 정보만 먼저 Firestore에 저장 ---
    // 이렇게 하면 이미지가 업로드되는 동안에도 사용자는 제출이 시작되었다고 인지 가능
    const reviewData = {
      mainAccountId: currentUser.uid,
      subAccountId: form.subAccountId,
      productId: selectedProduct.id,
      productName: selectedProduct.productName || '상품명 없음', 
      reviewType: selectedProduct.reviewType || '현영',
      createdAt: serverTimestamp(),
      status: 'uploading_images', // 'submitted' 대신 이미지 업로드 중이라는 임시 상태 사용
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
    };

    try {
      const docRef = await addDoc(collection(db, 'reviews'), reviewData);
      setSubmissionStatus('이미지 파일 처리 중...');

      // --- 2단계: 이미지들을 하나씩 압축 및 업로드하고, URL을 Firestore 문서에 업데이트 ---
      const allImageFiles = UPLOAD_FIELDS.flatMap(field => 
        (images[field.key] || []).map(file => ({ fieldName: field.key, file }))
      );

      const urlMap = {};
      for (let i = 0; i < allImageFiles.length; i++) {
        const { fieldName, file } = allImageFiles[i];
        const fieldKeyForUrl = `${fieldName}Urls`;
        
        setSubmissionStatus(`이미지 업로드 중... (${i + 1}/${allImageFiles.length})`);

        const storageRef = ref(storage, `reviewImages/${docRef.id}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(snapshot.ref);
        
        if (!urlMap[fieldKeyForUrl]) {
          urlMap[fieldKeyForUrl] = [];
        }
        urlMap[fieldKeyForUrl].push(downloadUrl);
      }

      // --- 3단계: 모든 이미지 URL과 최종 상태를 Firestore에 업데이트 ---
      setSubmissionStatus('최종 정보 업데이트 중...');
      await updateDoc(docRef, {
        status: 'submitted', // 최종 상태로 변경
        ...urlMap,
      });

      const hasAnyImage = Object.keys(images).some(key => images[key] && images[key].length > 0);
      const msg = hasAnyImage
        ? '리뷰가 성공적으로 제출되었습니다.'
        : '리뷰 정보가 제출되었습니다. 이미지를 등록하시려면 "리뷰 관리" 페이지를 이용해주세요.';
      alert(msg);
      navigate('/reviewer/my-reviews', { replace: true });

    } catch (err) {
      alert(`제출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. 오류: ${err.message}`);
      console.error("제출 실패:", err);
      // 오류 발생 시 생성된 review 문서를 삭제하거나, 사용자에게 재시도를 안내할 수 있습니다.
      // 여기서는 간단히 알림만 표시합니다.
    } finally {
      setSubmitting(false);
      setSubmissionStatus('');
    }
  };
  // ▲▲▲ [수정] 완료 ▲▲▲

  const handleMainButtonClick = () => { if (currentUser) { if (selectedProduct) { setIsAccountModalOpen(true); } else { alert("먼저 참여할 상품을 선택해주세요."); } } else { setIsLoginModalOpen(true); } };
  const handleLoginSuccess = () => setIsLoginModalOpen(false);

  const handleProductSelect = (e) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId) || null;
    setSelectedProduct(product);
    setIsAccountSelected(false);
    
    if (product) {
      setForm(prev => ({
        ...prev,
        paymentType: product.reviewType || '현영',
        productType: product.productType || '실배송',
        reviewOption: product.reviewOption || '별점',
      }));
    }
  };

  const handleSelectAccount = (subAccount) => {
    setForm(prev => ({
      ...prev,
      subAccountId: subAccount.id,
      name: subAccount.name || '',
      phoneNumber: subAccount.phoneNumber || '',
      participantId: subAccount.participantId || '',
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
      <Card>
        <CardHeader>
          <CardTitle>구매 폼 작성</CardTitle>
          {!currentUser && (
            <CardDescription>
              로그인 후 배정받은 상품을 선택해주세요.<br />
              회원가입 시 전화번호는 숫자만 입력하세요.<br /><br />
              회원가입은 지금 본인 이름과 전화번호로 가입하시고<br />
              계정 추가 시 실제 진행 계정을 입력하셔서 등록하세요.<br />
              * 타계정도 본인 이름과 전화번호로 가입하셔야합니다. *<br />
              지금 가입하시는 하나의 이름과 전화번호로 전부 관리하는겁니다.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoginModalOpen && (
            <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />
          )}
          {currentUser ? (
            <Button onClick={() => auth.signOut()} variant="outline" className="logout-btn">로그아웃</Button>
          ) : (
            <Button onClick={() => setIsLoginModalOpen(true)} className="login-open-btn">로그인 / 회원가입</Button>
          )}

      {currentUser && !productIdFromUrl && (
        <div className="field">
          <label>상품 선택</label>
          <input
            type="text"
            placeholder="상품명 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
          <select onChange={handleProductSelect} value={selectedProduct?.id || ''}>
            <option value="" disabled>체험단 상품을 선택해 주세요</option>
            {filteredProducts.map(p => (
              <option key={p.id} value={p.id}>
                {p.productName} ({p.reviewType})
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedProduct && (<>
          <div className="product-info-box">
            <h4>{selectedProduct.productName}</h4>
            <p><strong>결제 종류:</strong> {selectedProduct.reviewType}</p>
            {selectedProduct.productType && (<p><strong>상품 종류:</strong> {selectedProduct.productType}</p>)}
            {selectedProduct.reviewOption && (<p><strong>리뷰 종류:</strong> {selectedProduct.reviewOption}</p>)}
            <p><strong>진행 일자:</strong> {selectedProduct.reviewDate}</p>
            {selectedProduct.guide && (<div className="guide-content"><strong>가이드:</strong><p style={{whiteSpace: 'pre-line'}}>{selectedProduct.guide}</p></div>)}
          </div>
          <div className="account-selection-action">
            <Button type="button" onClick={handleMainButtonClick}>{isAccountSelected ? '✓ 계정 선택 완료 (변경하기)' : '구매 폼 작성하기'}</Button>
          </div>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="field">
            <Label htmlFor="name">구매자(수취인)</Label>
            <Input id="name" name="name" value={form.name} onChange={onFormChange} required />
          </div>
          <div className="field">
            <Label htmlFor="phoneNumber">전화번호</Label>
            <Input id="phoneNumber" name="phoneNumber" value={form.phoneNumber} onChange={onFormChange} required />
          </div>
          <div className="field">
            <Label htmlFor="address">주소</Label>
            {addressOptions.length > 0 ? (
              <select name="address" value={form.address} onChange={onFormChange} required className="w-full border rounded-md p-2">
                {addressOptions.map((addr, idx) => (
                  <option key={idx} value={addr}>{addr}</option>
                ))}
              </select>
            ) : (
              <Input id="address" name="address" value={form.address} onChange={onFormChange} required />
            )}
          </div>
          <div className="field">
            <Label htmlFor="bank">은행</Label>
            <Input id="bank" name="bank" value={form.bank} onChange={onFormChange} required />
          </div>
          <div className="field">
            <Label htmlFor="bankNumber">계좌번호</Label>
            <Input id="bankNumber" name="bankNumber" value={form.bankNumber} onChange={onFormChange} required />
          </div>
          <div className="field">
            <Label htmlFor="accountHolderName">예금주</Label>
            <Input id="accountHolderName" name="accountHolderName" value={form.accountHolderName} onChange={onFormChange} required />
          </div>
          
          <div className="field">
            <Label htmlFor="participantId">쿠팡 ID</Label>
            <Input id="participantId" name="participantId" value={form.participantId} onChange={onFormChange} placeholder="쿠팡 ID를 입력하세요" required />
          </div>
          <div className="field">
            <Label htmlFor="orderNumber">주문번호</Label>
            <Input id="orderNumber" name="orderNumber" value={form.orderNumber} onChange={onFormChange} placeholder="주문번호를 그대로 복사하세요" required />
          </div>
          <div className="field">
            <Label htmlFor="rewardAmount">금액</Label>
            <Input
              id="rewardAmount"
              name="rewardAmount"
              value={form.rewardAmount ? Number(form.rewardAmount).toLocaleString() : ''}
              onChange={onFormChange}
              placeholder="결제금액을 입력하세요"
              required
            />
          </div>
          <div className="field">
            <Label htmlFor="paymentType">결제유형(선택하세요)</Label>
            <select id="paymentType" name="paymentType" value={form.paymentType} onChange={onFormChange} className="w-full border rounded-md p-2">
              <option value="현영">현영</option>
              <option value="자율결제">자율결제</option>
            </select>
          </div>
          <div className="field">
            <Label htmlFor="productType">상품종류(선택하세요)</Label>
            <select id="productType" name="productType" value={form.productType} onChange={onFormChange} className="w-full border rounded-md p-2">
              <option value="실배송">실배송</option>
              <option value="빈박스">빈박스</option>
            </select>
          </div>
          <div className="field">
            <Label htmlFor="reviewOption">리뷰종류(선택하세요)</Label>
            <select id="reviewOption" name="reviewOption" value={form.reviewOption} onChange={onFormChange} className="w-full border rounded-md p-2">
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
                  <option value="프리미엄(포토)">프리미엄(포토)</option>
                  <option value="프리미엄(영상)">프리미엄(영상)</option>
                </>
              )}
            </select>
          </div>

          <hr className="section-divider" />
          {!showImageUpload && (
            <Button
              type="button"
              className="upload-toggle-btn"
              onClick={() => setShowImageUpload(true)}
            >
              이미지 지금 등록하기
            </Button>
          )}
          <p className="upload-note">이미지 등록 생략하고 제출 후, 리뷰관리에서 업로드 하셔도 됩니다</p>

          {showImageUpload && (
            <>
          <div className="image-upload-group">
            {UPLOAD_FIELDS.filter(f => f.group === 'keyword-like').map(({ key, label }) => (
              <div className="field" key={key}>
                <label>{label} (최대 5장)</label>
                <input type="file" accept="image/*" name={key} onChange={onFileChange} multiple disabled={imageProcessingStatus[key]} />
                
                {/* ▼▼▼ [추가] 이미지 처리 중 알림 메시지 ▼▼▼ */}
                {imageProcessingStatus[key] && (
                  <div className="image-processing-notice">
                    이미지 처리 중입니다. 파일 목록이 표시될 때까지 잠시만 기다려주세요...
                  </div>
                )}
                {/* ▲▲▲ [추가] 완료 ▲▲▲ */}

                <div className="file-list" style={{ marginTop: '8px', fontSize: '13px', color: '#555' }}>
                  {images[key] && images[key].length > 0 ? (
                    images[key].map((file, i) => (
                      <div key={`${file.name}-${i}`}>{i + 1}. {file.name}</div>
                    ))
                  ) : (
                    <div style={{ color: '#999' }}>선택된 파일 없음</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="image-upload-group">
            <h4>2. 구매 & 증빙 인증</h4>
            {UPLOAD_FIELDS.filter(f => f.group === 'purchase').map(({ key, label }) => (
              <div className="field" key={key}>
                <label>{label} (최대 5장)</label>
                <input type="file" accept="image/*" name={key} onChange={onFileChange} multiple disabled={imageProcessingStatus[key]} />

                {/* ▼▼▼ [추가] 이미지 처리 중 알림 메시지 (동일한 로직) ▼▼▼ */}
                {imageProcessingStatus[key] && (
                  <div className="image-processing-notice">
                    이미지 처리 중입니다. 파일 목록이 표시될 때까지 잠시만 기다려주세요...
                  </div>
                )}
                {/* ▲▲▲ [추가] 완료 ▲▲▲ */}

                <div className="file-list" style={{ marginTop: '8px', fontSize: '13px', color: '#555' }}>

                      {images[key] && images[key].length > 0 ? (
                        images[key].map((file, i) => (
                          <div key={`${file.name}-${i}`}>{i + 1}. {file.name}</div>
                        ))
                      ) : (
                        <div style={{ color: '#999' }}>선택된 파일 없음</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          
          <div className="field">
            <label>
              <input 
                type="checkbox" 
                checked={isAgreed}
                onChange={(e) => setIsAgreed(e.target.checked)}
              /> 개인정보 이용에 동의합니다.
            </label>
          </div>
          <Button
            className="submit-btn"
            type="submit"
            disabled={!isFormValid || submitting}
          >
            {/* ▼▼▼ [수정] 버튼 텍스트를 제출 상태에 따라 동적으로 변경 ▼▼▼ */}
            {submitting ? submissionStatus : '제출하기'}
            {/* ▲▲▲ [수정] 완료 ▲▲▲ */}
          </Button>
        </form>
      )}
        </CardContent>
      </Card>
    </div>
  );
}
