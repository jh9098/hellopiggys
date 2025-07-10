// src/components/AccountModal.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
import { auth, db, functions, collection, doc, setDoc, getDocs, addDoc, query, where, serverTimestamp, deleteDoc } from '../firebaseConfig';
import './AccountModal.css';

const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

const initialSubAccountState = {
  id: null,
  name: '',
  phoneNumber: '',
  address: '',
  addresses: [],
  bank: '',
  bankNumber: '',
  accountHolderName: ''
};

export default function AccountModal({ onClose, onSelectAccount }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [currentMainAccountId, setCurrentMainAccountId] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formAccount, setFormAccount] = useState(initialSubAccountState);
  const [newAddress, setNewAddress] = useState('');

  // ▼▼▼ 핵심 수정 부분 ▼▼▼
  // 모달이 마운트될 때, 이미 로그인된 사용자 정보를 기반으로 서브 계정을 불러옵니다.
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentMainAccountId(user.uid);
      fetchSubAccounts(user.uid);
    } else {
      // 이 경우는 발생하면 안 되지만, 안전장치로 에러 처리
      setError("로그인 정보가 유효하지 않습니다. 다시 시도해주세요.");
      setTimeout(onClose, 2000); // 2초 후 모달 닫기
    }
  }, []); // 의존성 배열을 비워 최초 1회만 실행되도록 합니다.

  const fetchSubAccounts = async (uid) => {
    try {
      const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', uid));
      const querySnapshot = await getDocs(q);
      const accounts = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          addresses: data.addresses || (data.address ? [data.address] : []),
          address: data.address || (data.addresses ? data.addresses[0] : '')
        };
      });
      setSubAccounts(accounts);
    } catch (err) {
        setError("계정 목록을 불러오는 데 실패했습니다.");
        console.error(err);
    }
  };
  
  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentMainAccountId);
    onClose();
  };

  const handleEditClick = (subAccount) => {
    setIsEditing(true);
    setFormAccount({
      ...initialSubAccountState,
      ...subAccount,
      addresses: subAccount.addresses || (subAccount.address ? [subAccount.address] : []),
      address: subAccount.address || (subAccount.addresses ? subAccount.addresses[0] : '')
    });
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormAccount(initialSubAccountState);
    setNewAddress('');
  };
  
  const handleDeleteClick = async (subAccountId) => {
    if (!window.confirm('정말로 이 계정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const subAccountRef = doc(db, 'subAccounts', subAccountId);
      await deleteDoc(subAccountRef);
      setSubAccounts(prevAccounts => prevAccounts.filter(acc => acc.id !== subAccountId));
      alert('계정이 성공적으로 삭제되었습니다.');
    } catch (err) {
      console.error("계정 삭제 실패:", err);
      setError(`삭제 처리 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAddress = () => {
    const addr = newAddress.trim();
    if (!addr) return;
    setFormAccount(prev => ({
      ...prev,
      addresses: [...prev.addresses, addr],
      address: addr
    }));
    setNewAddress('');
  };

  const handleRemoveAddress = (addr) => {
    setFormAccount(prev => {
      const list = prev.addresses.filter(a => a !== addr);
      const current = prev.address === addr ? (list[0] || '') : prev.address;
      return { ...prev, addresses: list, address: current };
    });
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
        // 새 계정을 바로 선택할 수 있도록 id가 덮어써지지 않게 순서를 조정합니다.
        onSelectAccount({ ...formAccount, id: subAccountRef.id }, currentMainAccountId);
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
    // 전화번호나 계좌번호 필드는 숫자만 입력되도록 처리
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
        
        {/* 불필요한 step === 1 로직을 제거하고 바로 계정 선택/추가 화면을 보여줍니다. */}
        <div>
          <h3>구매할 계정 선택 또는 추가</h3>
          {subAccounts.length > 0 && (
            <div className="sub-account-list">
              <h4>등록된 계정 목록</h4>
              {subAccounts.map(acc => (
                <div key={acc.id} className="sub-account-item">
                  <span onClick={() => handleSelectSubAccount(acc)} className="account-info">{acc.name} ({acc.phoneNumber})</span>
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
            <input type="text" placeholder="이름 (수취인)" name="name" value={formAccount.name} onChange={handleFormChange} required />
            <input type="tel" placeholder="전화번호" name="phoneNumber" value={formAccount.phoneNumber} onChange={handleFormChange} required />
            <div className="address-group">
              <select name="address" value={formAccount.address} onChange={handleFormChange} required>
                <option value="" disabled>주소 선택</option>
                {formAccount.addresses.map((addr, idx) => (
                  <option key={idx} value={addr}>{addr}</option>
                ))}
              </select>
              <div className="add-address-row">
                <input
                  type="text"
                  placeholder="새 주소 입력"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
                <button type="button" onClick={handleAddAddress}>추가</button>
              </div>
              {formAccount.addresses.length > 0 && (
                <ul className="address-list">
                  {formAccount.addresses.map((addr, idx) => (
                    <li key={idx}>
                      {addr}
                      <button type="button" onClick={() => handleRemoveAddress(addr)}>삭제</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <select name="bank" value={formAccount.bank} onChange={handleFormChange} required>
              <option value="" disabled>은행 선택</option>
              {bankOptions.map(bank => <option key={bank} value={bank}>{bank}</option>)}
            </select>
            <input type="text" placeholder="계좌번호 ('-' 없이 입력)" name="bankNumber" value={formAccount.bankNumber} onChange={handleFormChange} required/>
            <input type="text" placeholder="예금주" name="accountHolderName" value={formAccount.accountHolderName} onChange={handleFormChange} required/>
            <div className="form-actions">
              <button type="submit" disabled={submitting}>{submitting ? '처리 중...' : (isEditing ? '수정하기' : '이 계정으로 시작하기')}</button>
              {isEditing && (<button type="button" onClick={handleCancelEdit} className="cancel-btn" disabled={submitting}>취소</button>)}
            </div>
            {error && <p className="error-msg">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}