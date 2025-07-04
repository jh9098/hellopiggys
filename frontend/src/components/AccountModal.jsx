// src/components/AccountModal.jsx

import { useState, useEffect } from 'react';
import { db, collection, doc, getDocs, setDoc, addDoc, query, where, serverTimestamp } from '../firebaseConfig';
import { createMainAccountId } from '../utils';
import './AccountModal.css';

const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

// 폼 초기화용 데이터
const initialSubAccountState = { 
  id: null, name: '', phoneNumber: '', address: '', detailAddress: '', 
  bank: '', bankNumber: '', accountHolderName: '' 
};

export default function AccountModal({ onClose, onSelectAccount }) {
  const [step, setStep] = useState(1);
  // 1. localStorage에서 최근 입력 정보를 가져와 초기 상태로 설정
  const [mainName, setMainName] = useState(localStorage.getItem('SAVED_MAIN_NAME') || '');
  const [mainPhone, setMainPhone] = useState(localStorage.getItem('SAVED_MAIN_PHONE') || '');
  
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [currentMainAccountId, setCurrentMainAccountId] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);

  // 2. 수정/생성 폼을 위한 상태
  const [isEditing, setIsEditing] = useState(false);
  const [formAccount, setFormAccount] = useState(initialSubAccountState);

  // 1단계: 본계정 정보 제출 및 확인
  const handleMainAccountSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!mainName.trim() || !mainPhone.trim()) {
      setError('이름과 전화번호를 모두 입력하세요.');
      return;
    }

    setSubmitting(true);

    // 1-1. 최근 입력 정보를 localStorage에 저장
    localStorage.setItem('SAVED_MAIN_NAME', mainName.trim());
    localStorage.setItem('SAVED_MAIN_PHONE', mainPhone.trim());
    
    const accountId = createMainAccountId(mainName, mainPhone);
    setCurrentMainAccountId(accountId);
    
    // 타계정 목록 불러오기
    await fetchSubAccounts(accountId);
    
    setStep(2); // 타계정 선택/생성 단계로
    setSubmitting(false);
  };

  // 타계정 목록을 불러오는 함수 분리
  const fetchSubAccounts = async (accountId) => {
    const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', accountId));
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setSubAccounts(accounts);
  };

  // 2단계: 타계정 선택
  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentMainAccountId);
    onClose();
  };

  // 2단계: '수정' 버튼 클릭 시
  const handleEditClick = (subAccount) => {
    setIsEditing(true);
    setFormAccount(subAccount);
  };

  // 2단계: '취소' 버튼 클릭 시 (수정 취소)
  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormAccount(initialSubAccountState);
  }

  // 2단계: 새 타계정 생성 또는 기존 타계정 수정
  const handleSubAccountFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // 본계정이 없으면 생성
      const mainAccountRef = doc(db, 'mainAccounts', currentMainAccountId);
      await setDoc(mainAccountRef, { name: mainName, phone: mainPhone, createdAt: serverTimestamp() }, { merge: true });
      
      if (isEditing) {
        // --- 수정 로직 ---
        const subAccountRef = doc(db, 'subAccounts', formAccount.id);
        await setDoc(subAccountRef, { ...formAccount, mainAccountId: currentMainAccountId }, { merge: true });
        alert('계정이 수정되었습니다.');
        
        // 목록 실시간 업데이트
        setSubAccounts(subAccounts.map(acc => acc.id === formAccount.id ? formAccount : acc));
        
        // 폼 초기화
        handleCancelEdit();

      } else {
        // --- 생성 로직 ---
        const subAccountRef = await addDoc(collection(db, 'subAccounts'), {
          ...formAccount,
          mainAccountId: currentMainAccountId,
          createdAt: serverTimestamp(),
        });
        alert('새 계정이 등록되었습니다.');
        onSelectAccount({ id: subAccountRef.id, ...formAccount }, currentMainAccountId);
        onClose();
      }

    } catch (err) {
      setError(`작업에 실패했습니다: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // 폼 입력 핸들러
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    // 숫자만 입력되도록 처리
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
            <p>서비스 이용을 위해 본인 정보를 입력해주세요.</p>
            <input type="text" placeholder="이름" value={mainName} onChange={e => setMainName(e.target.value)} required />
            <input type="tel" placeholder="전화번호" value={mainPhone} onChange={e => setMainPhone(e.target.value)} required />
            <button type="submit" disabled={submitting}>{submitting ? '확인 중...' : '다음'}</button>
            {error && <p className="error-msg">{error}</p>}
          </form>
        )}

        {step === 2 && (
          <div>
            <h3>구매할 계정 선택 또는 생성</h3>
            {/* 기존 타계정 목록 */}
            {subAccounts.length > 0 && (
              <div className="sub-account-list">
                <h4>등록된 계정 목록</h4>
                {subAccounts.map(acc => (
                  <div key={acc.id} className="sub-account-item">
                    <span onClick={() => handleSelectSubAccount(acc)} className="account-info">
                      {acc.name} ({acc.phoneNumber})
                    </span>
                    <button onClick={() => handleEditClick(acc)} className="edit-btn">수정</button>
                  </div>
                ))}
              </div>
            )}
            
            {/* 새 타계정 생성/수정 폼 */}
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
                {isEditing && (
                  <button type="button" onClick={handleCancelEdit} className="cancel-btn" disabled={submitting}>취소</button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}