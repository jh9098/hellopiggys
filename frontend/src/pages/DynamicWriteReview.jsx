import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, getDoc, setDoc, collection, serverTimestamp, getDocs, query, where, updateDoc, increment } from '../firebaseConfig';
import AccountModal from '../components/AccountModal';

export default function DynamicWriteReview() {
  const { linkId } = useParams();
  const navigate = useNavigate();

  const [linkData, setLinkData] = useState(null);
  const [review, setReview] = useState({ rating: 5, text: '', image: null });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [mainAccount, setMainAccount] = useState({ name: '', phone: '' });
  const [selectedAccountForReview, setSelectedAccountForReview] = useState(null);
  const [mainAccountId, setMainAccountId] = useState(null);
  const [isAccountSelected, setIsAccountSelected] = useState(false); // 계정 선택 여부

  const fetchLinkData = useCallback(async () => {
    try {
      const linkRef = doc(db, 'links', linkId);
      const linkSnap = await getDoc(linkRef);
      if (linkSnap.exists()) {
        setLinkData(linkSnap.data());
      } else {
        setError('유효하지 않은 링크입니다.');
      }
    } catch (err) {
      setError('링크 정보를 불러오는 데 실패했습니다.');
      console.error(err);
    }
  }, [linkId]);

  useEffect(() => {
    fetchLinkData();
  }, [fetchLinkData]);

  const handleSelectAccount = (account, mainAccId) => {
    setSelectedAccountForReview(account);
    setMainAccountId(mainAccId);
    setIsAccountSelected(true); // 계정이 선택됨
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAccountForReview) {
      setError('리뷰를 작성할 계정을 선택해주세요.');
      return;
    }
    // ... (rest of the submit logic)
  };

  if (error) {
    return <div className="container"><h1>{error}</h1></div>;
  }

  if (!linkData) {
    return <div className="container"><h1>Loading...</h1></div>;
  }

  return (
    <div className="container">
      <h1>{linkData.productName}</h1>
      <p>리뷰를 작성해주세요.</p>

      <button onClick={() => setShowModal(true)} className="account-select-btn">
        회원 정보 입력/선택
      </button>

      {selectedAccountForReview && (
        <div className="selected-account-info">
          <p><strong>리뷰 작성 계정:</strong> {selectedAccountForReview.name} ({selectedAccountForReview.phoneNumber})</p>
        </div>
      )}

      {showModal && (
        <AccountModal 
          mainAccount={mainAccount}
          onClose={() => setShowModal(false)} 
          onSelectAccount={handleSelectAccount} 
        />
      )}

      <form onSubmit={handleSubmit} className="review-form" style={{ display: isAccountSelected ? 'block' : 'none' }}>
        {/* Rating, Text, Image inputs here */}
      </form>
    </div>
  );
}