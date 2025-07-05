// src/components/AccountModal.jsx (수정된 최종 버전)

import { useState, useEffect } from 'react';
import { auth, db, collection, doc, getDocs, setDoc, addDoc, query, where, serverTimestamp } from '../firebaseConfig';
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
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [subAccounts, setSubAccounts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formAccount, setFormAccount] = useState(initialSubAccountState);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setCurrentUser(user);
      fetchSubAccounts(user.uid);
    } else {
      setError("로그인 정보가 없습니다. 페이지를 새로고침 해주세요.");
    }
  }, []);

  const fetchSubAccounts = async (uid) => {
    const q = query(collection(db, 'subAccounts'), where('mainAccountId', '==', uid));
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setSubAccounts(accounts);
  };

  const handleSelectSubAccount = (subAccount) => {
    onSelectAccount(subAccount, currentUser.uid);
    onClose();
  };

  const handleEditClick = (subAccount) => {
    setIsEditing(true);
    setFormAccount(subAccount);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFormAccount(initialSubAccountState);
  }

  const handleSubAccountFormSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return setError("로그인 정보가 유효하지 않습니다.");
    setSubmitting(true);
    setError('');
    try {
      const mainAccountId = currentUser.uid;
      if (isEditing) {
        const subAccountRef = doc(db, 'subAccounts', formAccount.id);
        const updatedData = { ...formAccount, mainAccountId };
        delete updatedData.id;
        await setDoc(subAccountRef, updatedData, { merge: true });
        alert('계정이 수정되었습니다.');
        setSubAccounts(subAccounts.map(acc => acc.id === formAccount.id ? { ...formAccount } : acc));
        handleCancelEdit();
      } else {
        const subAccountData = { ...formAccount, mainAccountId, createdAt: serverTimestamp() };
        delete subAccountData.id;
        const subAccountRef = await addDoc(collection(db, 'subAccounts'), subAccountData);
        alert('새 계정이 등록되었습니다.');
        onSelectAccount({ id: subAccountRef.id, ...formAccount }, mainAccountId);
        onClose();
      }
    } catch (err) {
      setError(`작업에 실패했습니다: ${err.message}`);
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
              <button type="submit" disabled={submitting || !currentUser}>{submitting ? '처리 중...' : (isEditing ? '수정하기' : '이 계정으로 시작하기')}</button>
              {isEditing && (<button type="button" onClick={handleCancelEdit} className="cancel-btn" disabled={submitting}>취소</button>)}
            </div>
            {error && <p className="error-msg">{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
}