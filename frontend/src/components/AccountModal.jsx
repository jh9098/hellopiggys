// src/components/AccountModal.jsx (수정된 최종 버전)

import { useState } from 'react';
// ▼▼▼ 1. firebaseConfig에서 가져오는 것 외에, signInAnonymously를 firebase/auth에서 직접 가져옵니다. ▼▼▼
import { signInAnonymously } from 'firebase/auth'; 
import { auth, db, collection, doc, setDoc, getDocs, addDoc, query, where, serverTimestamp } from '../firebaseConfig';
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

  // ▼▼▼ 1. useEffect를 사용하여 인증 상태를 확실히 감지합니다. ▼▼▼
  useEffect(() => {
    // onAuthStateChanged는 현재 사용자의 로그인 상태를 알려주는 리스너입니다.
    // user 객체가 있으면 로그인된 상태, null이면 로그아웃 상태입니다.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 이미 로그인된 상태라면, 바로 2단계로 넘어갈 준비를 합니다.
        setCurrentMainAccountId(user.uid);
        fetchSubAccounts(user.uid);
        setStep(2);
      } else {
        // 로그인되지 않은 상태라면, 1단계를 유지합니다.
        setStep(1);
      }
    });

    // 컴포넌트가 사라질 때 리스너를 정리합니다.
    return () => unsubscribe();
  }, []); // 이 useEffect는 처음 한 번만 실행됩니다.

  // ▼▼▼ 2. 1단계 제출 로직을 '로그인 시도'만 하도록 변경합니다. ▼▼▼
  const handleMainAccountSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!mainName.trim() || !mainPhone.trim()) {
      return setError('이름과 전화번호를 모두 입력하세요.');
    }
    setSubmitting(true);
    try {
      // 2-1. 먼저 익명 로그인을 '시도'합니다.
      await signInAnonymously(auth);
      
      // 2-2. setDoc 등 DB 작업은 여기서 하지 않습니다!
      //      로그인이 성공하면 위 useEffect의 onAuthStateChanged가 자동으로 감지하여
      //      DB 작업을 처리하고 2단계로 넘겨줄 것입니다.

      // 2-3. 사용자 편의를 위한 localStorage 저장
      localStorage.setItem('REVIEWER_NAME', mainName.trim());
      localStorage.setItem('REVIEWER_PHONE', mainPhone.trim());
      
    } catch (err) {
      console.error("익명 로그인 실패:", err);
      setError("로그인 처리 중 오류가 발생했습니다.");
      setSubmitting(false); // 실패 시 로딩 상태 해제
    }
    // 성공 시에는 onAuthStateChanged가 알아서 로딩 상태를 관리하므로 여기서 해제하지 않습니다.
  };

  // ▼▼▼ 3. fetchSubAccounts 함수를 약간 수정합니다. ▼▼▼
  const fetchSubAccounts = async (uid) => {
    // 3-1. DB 작업 전에, 먼저 users 컬렉션에 정보를 기록합니다.
    //      onAuthStateChanged 이후에 호출되므로, 이때는 auth 객체가 보장됩니다.
    await setDoc(doc(db, 'users', uid), {
      name: mainName.trim() || localStorage.getItem('REVIEWER_NAME') || '', // 상태가 비어있을 경우 localStorage 값 사용
      phone: mainPhone.trim() || localStorage.getItem('REVIEWER_PHONE') || '',
      uid: uid,
    }, { merge: true });

    // 3-2. 그 다음에 서브 계정 목록을 불러옵니다.
    const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', uid));
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setSubAccounts(accounts);
    setSubmitting(false); // 모든 작업이 끝나면 로딩 상태 해제
  };

  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentMainAccountId);
    onClose();
  };
  
  const handleEditClick = (subAccount) => { setIsEditing(true); setFormAccount(subAccount); };
  const handleCancelEdit = () => { setIsEditing(false); setFormAccount(initialSubAccountState); };

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
                    <button onClick={() => handleEditClick(acc)} className="edit-btn">수정</button>
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