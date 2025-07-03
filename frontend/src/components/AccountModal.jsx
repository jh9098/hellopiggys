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

export default function AccountModal({ mainAccount, onClose, onSelectAccount }) {
  const [step, setStep] = useState(1);
  const [mainName, setMainName] = useState(mainAccount?.name || '');
  const [mainPhone, setMainPhone] = useState(mainAccount?.phone || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentMainAccountId, setCurrentMainAccountId] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  const [newSubAccount, setNewSubAccount] = useState({ name: '', phoneNumber: '', address: '', detailAddress: '', bank: '', bankNumber: '', accountHolderName: '' });

  useEffect(() => {
    if (mainAccount?.name && mainAccount?.phone) {
      handleMainAccountSubmit();
    }
  }, [mainAccount]);

  const handleMainAccountSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSubmitting(true);
    const accountId = createMainAccountId(mainName, mainPhone);
    if (!accountId) {
      setError('이름과 전화번호를 모두 입력하세요.');
      setSubmitting(false);
      return;
    }
    
    const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', accountId));
    const querySnapshot = await getDocs(q);
    setSubAccounts(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    
    setCurrentMainAccountId(accountId);
    setStep(2);
    setSubmitting(false);
  };

  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentMainAccountId);
    onClose();
  };
  
  const handleCreateSubAccount = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const mainAccountRef = doc(db, 'mainAccounts', currentMainAccountId);
      await setDoc(mainAccountRef, { name: mainName, phone: mainPhone, createdAt: serverTimestamp() }, { merge: true });

      const subAccountRef = await addDoc(collection(db, 'subAccounts'), {
        ...newSubAccount,
        mainAccountId: currentMainAccountId,
        createdAt: serverTimestamp(),
      });

      const newSubAccountWithId = { id: subAccountRef.id, ...newSubAccount };
      setSubAccounts([...subAccounts, newSubAccountWithId]);
      setNewSubAccount({ name: '', phoneNumber: '', address: '', detailAddress: '', bank: '', bankNumber: '', accountHolderName: '' }); // 폼 초기화
      alert('새 계정이 추가되었습니다. 목록에서 선택해주세요.');

    } catch (err) {
      setError('계정 생성에 실패했습니다: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNumericInputChange = (e, field) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setNewSubAccount({ ...newSubAccount, [field]: value });
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
            {subAccounts.length > 0 && (
              <div className="sub-account-list">
                <h4>계정 선택</h4>
                {subAccounts.map(acc => (
                  <button key={acc.id} onClick={() => handleSelectSubAccount(acc)} className="sub-account-item">
                    {acc.name} ({acc.phoneNumber})
                  </button>
                ))}
              </div>
            )}
            
            <form onSubmit={handleCreateSubAccount} className="sub-account-form">
              <h4>새 계정 추가</h4>
              <input type="text" placeholder="이름" value={newSubAccount.name} onChange={e => setNewSubAccount({...newSubAccount, name: e.target.value})} required/>
              <input type="tel" placeholder="전화번호" value={newSubAccount.phoneNumber} onChange={e => handleNumericInputChange(e, 'phoneNumber')} required/>
              <input type="text" placeholder="주소" value={newSubAccount.address} onChange={e => setNewSubAccount({...newSubAccount, address: e.target.value})} />
              <input type="text" placeholder="상세주소" value={newSubAccount.detailAddress} onChange={e => setNewSubAccount({...newSubAccount, detailAddress: e.target.value})} />
              <select value={newSubAccount.bank} onChange={e => setNewSubAccount({ ...newSubAccount, bank: e.target.value })} required>
                <option value="" disabled>은행 선택</option>
                {bankOptions.map(bank => <option key={bank} value={bank}>{bank}</option>)}
              </select>
              <input type="text" placeholder="계좌번호" value={newSubAccount.bankNumber} onChange={e => handleNumericInputChange(e, 'bankNumber')} />
              <input type="text" placeholder="예금주" value={newSubAccount.accountHolderName} onChange={e => setNewSubAccount({...newSubAccount, accountHolderName: e.target.value})} />
              <button type="submit" disabled={submitting}>{submitting ? '추가하기' : '추가하기'}</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}