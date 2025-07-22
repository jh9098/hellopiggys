// src/components/AccountModal.jsx (쿠팡 ID 필드 추가 완료)

import { useState, useEffect } from 'react';
import { auth, db, functions, collection, doc, setDoc, getDocs, addDoc, query, where, serverTimestamp, deleteDoc } from '../firebaseConfig';
import './AccountModal.css';

const bankOptions = [
  '신한', '국민', '산업', 'KEB하나', '케이뱅크', '경남', '저축', '우리', 
  '카카오뱅크', '광주', '새마을금고', '우체국', '토스뱅크', '기업', '수협', 
  '전북', '농협', 'SC', '아이엠뱅크', '신협', '제주', '부산', '씨티', 'HSBC'
];

// ▼▼▼ 여기에 participantId 추가 ▼▼▼
const initialSubAccountState = {
  id: null,
  name: '',
  phoneNumber: '',
  participantId: '', // 쿠팡 ID 필드 추가
  address: '',
  addresses: [],
  bank: '',
  bankNumber: '',
  accountHolderName: ''
};

export default function AccountModal({ onClose, onSelectAccount, onAddressAdded }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [currentMainAccountId, setCurrentMainAccountId] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [formAccount, setFormAccount] = useState(initialSubAccountState);
  const [newAddress, setNewAddress] = useState('');
  const [globalAddresses, setGlobalAddresses] = useState([]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentMainAccountId(user.uid);
      fetchSubAccounts(user.uid);
      fetchGlobalAddresses(user.uid);
    } else {
      setError("로그인 정보가 유효하지 않습니다. 다시 시도해주세요.");
      setTimeout(onClose, 2000);
    }
  }, []);

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

  const fetchGlobalAddresses = async (uid) => {
    try {
      const q = query(collection(db, 'addresses'), where('mainAccountId', '==', uid));
      const snap = await getDocs(q);
      setGlobalAddresses(snap.docs.map(d => d.data().value));
    } catch (err) {
      console.error('주소 목록을 불러오는 데 실패했습니다.', err);
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

  const handleAddAddress = async () => {
    const addr = newAddress.trim();
    if (!addr) return;
    setFormAccount(prev => ({
      ...prev,
      addresses: [...prev.addresses, addr],
      address: addr
    }));
    setNewAddress('');
    if (!globalAddresses.includes(addr)) {
      try {
        await addDoc(collection(db, 'addresses'), {
          value: addr,
          mainAccountId: currentMainAccountId,
          createdAt: serverTimestamp(),
        });
        setGlobalAddresses(prev => [...prev, addr]);
        if (onAddressAdded) onAddressAdded(addr);
      } catch (err) {
        console.error('주소 저장 실패:', err);
      }
    } else {
      if (onAddressAdded) onAddressAdded(addr);
    }
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
        setSubAccounts(prev => [...prev, { ...formAccount, id: subAccountRef.id }]);
        setFormAccount(initialSubAccountState);
        setNewAddress('');
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
        
        <div>
          <h3>구매할 계정 선택 또는 추가</h3>
          {subAccounts.length > 0 && (
            <div className="sub-account-list">
              <h4>진행할 계정을 선택해 주세요</h4>
              {subAccounts.map(acc => (
                <div key={acc.id} className="sub-account-item">
                  <span
                    onClick={() => handleSelectSubAccount(acc)}
                    className="account-info"
                  >
                    {acc.name} ({acc.phoneNumber})
                  </span>
                  <div className="account-actions">
                    <button
                      type="button"
                      onClick={() => handleEditClick(acc)}
                      className="edit-btn"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteClick(acc.id)}
                      className="delete-btn"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSubAccountFormSubmit} className="sub-account-form">
            <h4>{isEditing ? '계정 정보 수정' : '새 계정 추가(주소만 추가하는 것도 가능)'}</h4>
            <input type="text" placeholder="이름 (수취인)" name="name" value={formAccount.name} onChange={handleFormChange} required />
            <input type="tel" placeholder="전화번호" name="phoneNumber" value={formAccount.phoneNumber} onChange={handleFormChange} required />
            
            {/* ▼▼▼ 여기에 쿠팡 ID 입력 필드 추가 ▼▼▼ */}
            <input 
              type="text" 
              placeholder="쿠팡 ID" 
              name="participantId" 
              value={formAccount.participantId} 
              onChange={handleFormChange} 
              required 
            />
            {/* ▲▲▲ 추가 완료 ▲▲▲ */}

            <div className="address-group">
              <select name="address" value={formAccount.address} onChange={handleFormChange} required>
                <option value="" disabled>주소 선택</option>
                {Array.from(new Set([...globalAddresses, ...formAccount.addresses])).map((addr, idx) => (
                  <option key={idx} value={addr}>{addr}</option>
                ))}
              </select>
              <div className="add-address-row">
                <input
                  type="text"
                  placeholder="새 주소 입력(여러개 추가 가능)"
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
              <button type="submit" disabled={submitting}>{submitting ? '처리 중...' : (isEditing ? '수정하기' : '이 계정 추가하기')}</button>
              {isEditing && (<button type="button" onClick={handleCancelEdit} className="cancel-btn" disabled={submitting}>취소</button>)}
            </div>
            {error && <p className="error-msg">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}
