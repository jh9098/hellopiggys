// src/pages/WriteReview.jsx (상품 시스템에 맞게 전면 수정)

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

export default function WriteReview() {
  const navigate = useNavigate();
  const storage = getStorageInstance();

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // 에러 상태 추가

  const [currentUser, setCurrentUser] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  
  const [form, setForm] = useState({
    participantId: '', orderNumber: '', rewardAmount: '', subAccountId: null,
  });
  const [images, setImages] = useState({});
  const [preview, setPreview] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isAccountSelected, setIsAccountSelected] = useState(false);
  const [selectedSubAccountInfo, setSelectedSubAccountInfo] = useState(null); // 선택된 서브 계정 정보 표시용

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) { // 로그아웃 시 상태 초기화
        setSelectedProduct(null);
        setIsAccountSelected(false);
      }
    });

    const fetchProducts = async () => {
      setLoading(true);
      setError(null); // 에러 상태 초기화
      try {
        // ▼▼▼ 쿼리를 다시 한번 명확하게 정의합니다. ▼▼▼
        const productsCollection = collection(db, 'products');
        const q = query(
          productsCollection, 
          where('progressStatus', '==', '진행중'), // '진행중' 상태인 문서만
          orderBy('createdAt', 'desc') // 최신순으로 정렬
        );
        // ▲▲▲ 쿼리 정의 ▲▲▲

        const snapshot = await getDocs(q);
        const productList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(productList);
        
      } catch (e) {
        // ▼▼▼ 에러 핸들링 강화 ▼▼▼
        console.error("상품 목록 로딩 실패:", e);
        if (e.code === 'failed-precondition') {
            setError(
                "데이터를 불러오는 데 필요한 색인(index)이 없습니다. Firebase 콘솔에서 에러 메시지에 나온 링크를 통해 색인을 생성해주세요. 생성에는 몇 분 정도 소요될 수 있습니다."
            );
        } else {
            setError("진행중인 상품 목록을 불러오는 데 실패했습니다.");
        }
        // ▲▲▲ 에러 핸들링 강화 ▲▲▲
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
    return () => unsubscribeAuth();
  }, []);

  const handleMainButtonClick = () => {
    if (currentUser) {
      if (selectedProduct) {
        setIsAccountModalOpen(true);
      } else {
        alert("먼저 참여할 상품을 선택해주세요.");
      }
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const handleLoginSuccess = () => setIsLoginModalOpen(false);

  const handleProductSelect = (e) => {
    const productId = e.target.value;
    const product = products.find(p => p.id === productId) || null;
    setSelectedProduct(product);
    setIsAccountSelected(false); // 상품 변경 시 계정 선택 초기화
  };

  const handleSelectAccount = (subAccount) => {
    setForm(prev => ({ ...prev, subAccountId: subAccount.id }));
    setSelectedSubAccountInfo(subAccount); // 화면 표시용 정보 저장
    setIsAccountSelected(true);
    setIsAccountModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser || !selectedProduct || !form.subAccountId) {
      return alert('로그인, 상품 선택, 계정 선택이 모두 완료되어야 합니다.');
    }
    setSubmitting(true);
    try {
      const urlMap = {};
      for (const [key, file] of Object.entries(images)) {
        const r = ref(storage, `reviewImages/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        urlMap[key + 'Url'] = await getDownloadURL(r);
      }
      
      const reviewData = {
        mainAccountId: currentUser.uid,
        subAccountId: form.subAccountId,
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        reviewType: selectedProduct.reviewType,
        createdAt: serverTimestamp(),
        status: 'submitted',
        orderNumber: form.orderNumber,
        rewardAmount: form.rewardAmount,
        participantId: form.participantId,
        ...urlMap,
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      alert('리뷰가 성공적으로 제출되었습니다.');
      navigate('/my-reviews', { replace: true });
    } catch (err) {
      alert('제출 실패: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = (e) => {
    const { name, files } = e.target;
    if (!files[0]) return;
    setImages({ ...images, [name]: files[0] });
    setPreview({ ...preview, [name]: URL.createObjectURL(files[0]) });
  };
  
  const onFormChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  if (loading) return <p style={{textAlign: 'center', padding: '50px'}}>페이지 정보를 불러오는 중...</p>;

  return (
    <div className="page-wrap">
      <h2 className="title">리뷰 작성</h2>
      
      {!currentUser && ( <div className="notice-box">로그인 후 참여할 상품을 선택해주세요.</div> )}

      {isLoginModalOpen && <LoginModal onClose={() => setIsLoginModalOpen(false)} onLoginSuccess={handleLoginSuccess} />}
      
      {currentUser ? (
        <button onClick={() => auth.signOut()} className="logout-btn" style={{marginBottom: '20px'}}>로그아웃</button>
      ) : (
        <button onClick={() => setIsLoginModalOpen(true)} style={{marginBottom: '20px'}}>로그인 / 회원가입</button>
      )}

      {currentUser && (
        <div className="field">
          <label>상품 선택</label>
          <select onChange={handleProductSelect} value={selectedProduct?.id || ''}>
            <option value="" disabled>참여할 상품을 선택하세요</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.productName} ({p.reviewType})</option>)}
          </select>
        </div>
      )}

      {selectedProduct && (
        <>
          <div className="product-info-box">
            <h4>{selectedProduct.productName}</h4>
            <p><strong>리뷰 종류:</strong> {selectedProduct.reviewType}</p>
            <p><strong>진행 일자:</strong> {selectedProduct.reviewDate}</p>
            {selectedProduct.guide && (
                <div className="guide-content">
                    <strong>가이드:</strong>
                    <p style={{whiteSpace: 'pre-line'}}>{selectedProduct.guide}</p>
                </div>
            )}
          </div>
          
          <div className="account-actions">
            <button type="button" onClick={handleMainButtonClick}>
              {isAccountSelected ? '✓ 계정 선택 완료 (변경하기)' : '구매/리뷰 진행 계정 선택'}
            </button>
          </div>

          {isAccountModalOpen && <AccountModal onClose={() => setIsAccountModalOpen(false)} onSelectAccount={handleSelectAccount}/>}
        </>
      )}
      
      {isAccountSelected && selectedSubAccountInfo && (
        <form onSubmit={handleSubmit}>
          {[
            { key: 'name', label: '구매자(수취인)', value: selectedSubAccountInfo.name },
            { key: 'phoneNumber', label: '전화번호', value: selectedSubAccountInfo.phoneNumber },
            { key: 'address', label: '주소', value: selectedSubAccountInfo.address },
            { key: 'bank', label: '은행', value: selectedSubAccountInfo.bank },
            { key: 'bankNumber', label: '계좌번호', value: selectedSubAccountInfo.bankNumber },
            { key: 'accountHolderName', label: '예금주', value: selectedSubAccountInfo.accountHolderName },
          ].map(({ key, label, value }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input value={value || ''} readOnly style={{background: '#f0f0f0', cursor: 'not-allowed'}}/>
            </div>
          ))}
          
          {[
            { key: 'participantId', label: '참가자 ID', ph: '참가자 ID를 입력하세요' },
            { key: 'orderNumber', label: '주문번호', ph: '주문번호를 그대로 복사하세요' },
            { key: 'rewardAmount', label: '금액', ph: '결제금액을 입력하세요' },
          ].map(({ key, label, ph }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input name={key} value={form[key]} onChange={onFormChange} placeholder={ph} required/>
            </div>
          ))}

          {[
            { key: 'likeImage', label: '상품 찜 캡처 (필수)' },
            { key: 'orderImage', label: '구매 인증 캡처 (필수)' },
            { key: 'cashcardImage', label: '현영/매출전표 (필수)' },
            { key: 'keywordImage', label: '키워드 인증 (필수)' },
          ].map(({ key, label }) => (
            <div className="field" key={key}>
              <label>{label}</label>
              <input type="file" accept="image/*" name={key} onChange={onFile} required />
              {preview[key] && (<img className="thumb" src={preview[key]} alt={key} />)}
            </div>
          ))}

          <div className="field"><label><input type="checkbox" required /> 개인정보 이용에 동의합니다.</label></div>
          <button className="submit-btn" type="submit" disabled={submitting}>{submitting ? '제출 중…' : '제출하기'}</button>
        </form>
      )}
    </div>
  );
}