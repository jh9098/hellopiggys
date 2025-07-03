// src/components/AccountModal.jsx

import { useState, useEffect } from 'react';
import { db, collection, doc, getDoc, getDocs, setDoc, addDoc, query, where, serverTimestamp } from '../firebaseConfig';
import { createMainAccountId } from '../utils';
import './AccountModal.css';

export default function AccountModal({ mode, mainAccount, onClose, onSelectAccount }) {
  const [step, setStep] = useState(1); // 1: 본계정 입력, 2: 타계정 선택/생성
  const [mainName, setMainName] = useState(mainAccount?.name || '');
  const [mainPhone, setMainPhone] = useState(mainAccount?.phone || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [currentMainAccountId, setCurrentMainAccountId] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);

  const [newSubAccount, setNewSubAccount] = useState({ name: '', phoneNumber: '', address: '', detailAddress: '', bank: '', bankNumber: '', accountHolderName: '' });

  // MyReviews에서 들어올 경우, 바로 2단계로 이동
  useEffect(() => {
    if (mainAccount?.name && mainAccount?.phone) {
      handleMainAccountSubmit();
    }
  }, [mainAccount]);


  // 1단계: 본계정 정보 제출 및 확인
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
    
    // 타계정 목록 불러오기
    const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', accountId));
    const querySnapshot = await getDocs(q);
    setSubAccounts(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    
    setCurrentMainAccountId(accountId);
    setStep(2); // 타계정 선택/생성 단계로
    setSubmitting(false);
  };

  // 2단계: 타계정 선택
  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentMainAccountId);
    onClose();
  };
  
  // 2단계: 새 타계정 생성
  const handleCreateSubAccount = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      // 본계정이 없으면 생성
      const mainAccountRef = doc(db, 'mainAccounts', currentMainAccountId);
      await setDoc(mainAccountRef, { name: mainName, phone: mainPhone, createdAt: serverTimestamp() }, { merge: true });

      // 새 타계정 추가
      const subAccountRef = await addDoc(collection(db, 'subAccounts'), {
        ...newSubAccount,
        mainAccountId: currentMainAccountId,
        createdAt: serverTimestamp(),
      });

      alert('새 계정이 등록되었습니다.');
      onSelectAccount({ id: subAccountRef.id, ...newSubAccount }, currentMainAccountId);
      onClose();

    } catch (err) {
      setError('계정 생성에 실패했습니다: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose}>✖</button>
        
        {step === 1 && (
          <form onSubmit={handleMainAccountSubmit}>
            <h3>본계정 정보 입력</h3>
            <p>서비스 이용을 위해 본인 정보를 입력해주세요.</p>
            <input type="text" placeholder="이름" value={mainName} onChange={e => setMainName(e.target.value)} required />
            <input type="tel" placeholder="전화번호" value={mainPhone} onChange={e => setMainPhone(e.target.value)} required />
            <button type="submit" disabled={submitting}>{submitting ? '확인 중...' : '다음'}</button>
            {error && <p className="error-msg">{error}</p>}
          </form>
        )}

        {step === 2 && (
          <div>
            <h3>작업 계정 선택 또는 생성</h3>
            {/* 기존 타계정 목록 */}
            {subAccounts.length > 0 && (
              <div className="sub-account-list">
                <h4>기존 계정 선택</h4>
                {subAccounts.map(acc => (
                  <button key={acc.id} onClick={() => handleSelectSubAccount(acc)} className="sub-account-item">
                    {acc.name} ({acc.phoneNumber})
                  </button>
                ))}
              </div>
            )}
            
            {/* 새 타계정 생성 폼 */}
            <form onSubmit={handleCreateSubAccount} className="sub-account-form">
              <h4>새 계정 추가</h4>
              <input type="text" placeholder="이름 (타계정)" value={newSubAccount.name} onChange={e => setNewSubAccount({...newSubAccount, name: e.target.value})} required/>
              <input type="tel" placeholder="전화번호 (타계정)" value={newSubAccount.phoneNumber} onChange={e => setNewSubAccount({...newSubAccount, phoneNumber: e.target.value})} required/>
              <input type="text" placeholder="주소" value={newSubAccount.address} onChange={e => setNewSubAccount({...newSubAccount, address: e.target.value})} />
              <input type="text" placeholder="상세주소" value={newSubAccount.detailAddress} onChange={e => setNewSubAccount({...newSubAccount, detailAddress: e.target.value})} />
              <input type="text" placeholder="은행" value={newSubAccount.bank} onChange={e => setNewSubAccount({...newSubAccount, bank: e.target.value})} />
              <input type="text" placeholder="계좌번호" value={newSubAccount.bankNumber} onChange={e => setNewSubAccount({...newSubAccount, bankNumber: e.target.value})} />
              <input type="text" placeholder="예금주" value={newSubAccount.accountHolderName} onChange={e => setNewSubAccount({...newSubAccount, accountHolderName: e.target.value})} />
              <button type="submit" disabled={submitting}>{submitting ? '추가 중...' : '이 계정으로 시작하기'}</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}