import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth'; // onAuthStateChanged 추가
// ▼▼▼ 수정된 부분 ▼▼▼: deleteDoc 함수를 추가로 가져옵니다.
import { auth, db, functions, collection, doc, setDoc, getDocs, addDoc, query, where, serverTimestamp, deleteDoc } from '../firebaseConfig';
import './AccountModal.css';


const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

const initialSubAccountState = { 
  id: null, name: '', phoneNumber: '', address: '',
  bank: '', bankNumber: '', accountHolderName: '' 
};

export default function AccountModal({ onClose, onSelectAccount }) {
  const [step, setStep] = useState(1);
  const [mainName, setMainName] = useState(localStorage.getItem('REVIEWER_NAME') || '');
  const [mainPhone, setMainPhone] = useState(localStorage.getItem('REVIEWER_PHONE') || '');
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [currentMainAccountId, setCurrentMainAccountId] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formAccount, setFormAccount] = useState(initialSubAccountState);

  // useEffect 로직은 이 컴포넌트의 역할과 맞지 않으므로 제거합니다.
  // ▼▼▼ 1. 로그인 상태를 감지하고, 로그인 후에만 DB 작업을 수행하는 useEffect ▼▼▼
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && step === 1 && submitting) {
        // [핵심] 1단계에서 '처리 중' 상태일 때 로그인 사용자가 감지되면,
        // 이 시점에서 DB 작업을 수행하고 2단계로 넘어갑니다.
        try {
          await setDoc(doc(db, 'users', user.uid), {
            name: localStorage.getItem('REVIEWER_NAME') || '', // 상태 대신 localStorage에서 가져옴
            phone: localStorage.getItem('REVIEWER_PHONE') || '',
            uid: user.uid,
          }, { merge: true });

          setCurrentMainAccountId(user.uid);
          await fetchSubAccounts(user.uid);
          setStep(2);

        } catch (dbError) {
          console.error("DB 작업 실패:", dbError);
          setError("데이터 처리 중 오류가 발생했습니다.");
        } finally {
          setSubmitting(false); // 모든 작업 후 로딩 해제
        }
      } else if (!user) {
        // 로그아웃 상태일 때
        setStep(1);
      }
    });
    return () => unsubscribe();
  }, [step, submitting]); // step과 submitting 상태가 바뀔 때마다 이 로직을 재평가

  // ▼▼▼ 2. 1단계 제출 로직은 '로그인'까지만 책임집니다. ▼▼▼
  const handleMainAccountSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!mainName.trim() || !mainPhone.trim()) {
      return setError('이름과 전화번호를 모두 입력하세요.');
    }
    setSubmitting(true);
    
    // 사용자 편의를 위해 localStorage에 먼저 저장
    localStorage.setItem('REVIEWER_NAME', mainName.trim());
    localStorage.setItem('REVIEWER_PHONE', mainPhone.trim());

    try {
      const createTokenFunction = httpsCallable(functions, 'createCustomToken');
      const result = await createTokenFunction({ name: mainName, phone: mainPhone });
      const { token } = result.data;
      
      // 커스텀 토큰으로 로그인 시도. 성공하면 위의 useEffect가 감지합니다.
      await signInWithCustomToken(auth, token);
      
    } catch (err) {
      console.error("커스텀 로그인 실패:", err);
      if (err.code === 'functions/unavailable' || err.code === 'internal') {
        setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError("로그인 처리 중 오류가 발생했습니다.");
      }
      setSubmitting(false); // 실패 시에만 여기서 로딩 해제
    }
  };

  const fetchSubAccounts = async (uid) => {
    const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', uid));
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setSubAccounts(accounts);
  };
  
  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentMainAccountId);
    onClose();
  };
  const handleEditClick = (subAccount) => { setIsEditing(true); setFormAccount(subAccount); };
  const handleCancelEdit = () => { setIsEditing(false); setFormAccount(initialSubAccountState); };
    // ▼▼▼ 추가된 부분: 계정 삭제 처리 함수 ▼▼▼
  const handleDeleteClick = async (subAccountId) => {
    // 실수로 삭제하는 것을 방지하기 위해 확인창을 띄웁니다.
    if (!window.confirm('정말로 이 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      // Firestore에서 해당 문서에 대한 참조를 생성합니다.
      const subAccountRef = doc(db, 'subAccounts', subAccountId);
      // 문서를 삭제합니다.
      await deleteDoc(subAccountRef);
      
      // 화면(State)에서도 삭제된 계정을 즉시 반영합니다.
      setSubAccounts(prevAccounts => prevAccounts.filter(acc => acc.id !== subAccountId));
      alert('계정이 성공적으로 삭제되었습니다.');
    } catch (err) {
      console.error("계정 삭제 실패:", err);
      setError(`삭제 처리 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubAccountFormSubmit = async (e) => {
    e.preventDefault();
    if (!currentMainAccountId) return setError("오류: 사용자 정보가 없습니다.");
    setSubmitting(true);
    setError('');
    try {
      if (isEditing) {
        const subAccountRef = doc(db, 'subAccounts', formAccount.id);
        const updatedData = { ...formAccount, mainAccountId: currentMainAccountId };
        delete updatedData.id;
        await setDoc(subAccountRef, updatedData, { merge: true });
        alert('계정이 수정되었습니다.');
        setSubAccounts(subAccounts.map(acc => acc.id === formAccount.id ? { ...formAccount } : acc));
        handleCancelEdit();
      } else {
        const subAccountData = { ...formAccount, mainAccountId: currentMainAccountId, createdAt: serverTimestamp() };
        delete subAccountData.id;
        const subAccountRef = await addDoc(collection(db, 'subAccounts'), subAccountData);
        alert('새 계정이 등록되었습니다.');
        onSelectAccount({ id: subAccountRef.id, ...formAccount }, currentMainAccountId);
        onClose();
      }
    } catch (err) {
      setError(`작업 실패: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber' || name === 'bankNumber') {
      setFormAccount({ ...formAccount, [name]: value.replace(/[^0-9]/g, '') });
    } else {
      setFormAccount({ ...formAccount, [name]: value });
    }
  };
  
  return (

    <div className="modal-back">
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>✖</button>
        
        {step === 1 && (
          <form onSubmit={handleMainAccountSubmit}>
            <h3>회원 정보 입력</h3>
            <p>리뷰 작성을 위해 본인 정보를 입력해주세요.<br/>(기존 회원은 정보 확인 후 다음 버튼을 누르세요)</p>
            <input type="text" placeholder="이름" value={mainName} onChange={e => setMainName(e.target.value)} required />
            <input type="tel" placeholder="전화번호" value={mainPhone} onChange={e => setMainPhone(e.target.value)} required />
            <button type="submit" disabled={submitting}>{submitting ? '확인 중...' : '다음'}</button>
            {error && <p className="error-msg">{error}</p>}
          </form>
        )}

        {step === 2 && (
          <div>
            <h3>구매할 계정 선택 또는 생성</h3>
            {subAccounts.length > 0 && (
              <div className="sub-account-list">
                <h4>등록된 계정 목록</h4>
                {subAccounts.map(acc => (
                  <div key={acc.id} className="sub-account-item">
                    <span onClick={() => handleSelectSubAccount(acc)} className="account-info">{acc.name} ({acc.phoneNumber})</span>
                    {/* ▼▼▼ 수정된 부분: 버튼을 div로 감싸고 삭제 버튼 추가 ▼▼▼ */}
                    <div className="account-actions">
                      <button onClick={() => handleEditClick(acc)} className="edit-btn">수정</button>
                      <button onClick={() => handleDeleteClick(acc.id)} className="delete-btn">삭제</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSubAccountFormSubmit} className="sub-account-form">
              <h4>{isEditing ? '계정 정보 수정' : '새 계정 추가'}</h4>
              <input type="text" placeholder="이름" name="name" value={formAccount.name} onChange={handleFormChange} required />
              <input type="tel" placeholder="전화번호" name="phoneNumber" value={formAccount.phoneNumber} onChange={handleFormChange} required />
              <input type="text" placeholder="주소" name="address" value={formAccount.address} onChange={handleFormChange} />
              <select name="bank" value={formAccount.bank} onChange={handleFormChange} required>
                <option value="" disabled>은행 선택</option>
                {bankOptions.map(bank => <option key={bank} value={bank}>{bank}</option>)}
              </select>
              <input type="text" placeholder="계좌번호" name="bankNumber" value={formAccount.bankNumber} onChange={handleFormChange} />
              <input type="text" placeholder="예금주" name="accountHolderName" value={formAccount.accountHolderName} onChange={handleFormChange} />
              <div className="form-actions">
                <button type="submit" disabled={submitting}>{submitting ? '처리 중...' : (isEditing ? '수정하기' : '이 계정으로 시작하기')}</button>
                {isEditing && (<button type="button" onClick={handleCancelEdit} className="cancel-btn" disabled={submitting}>취소</button>)}
              </div>
              {error && <p className="error-msg">{error}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
