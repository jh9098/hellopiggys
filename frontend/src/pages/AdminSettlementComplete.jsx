import { useEffect, useState } from 'react';
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc,
} from '../firebaseConfig';
import ReviewDetailModal from '../components/ReviewDetailModal';

export default function AdminSettlementComplete() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  
  const fetchSettledList = async () => {
    setLoading(true);
    const q = query(
      collection(db, 'reviews'),
      where('status', '==', 'settled'),
      orderBy('settledAt', 'desc')
    );
    const snap = await getDocs(q);

    const data = await Promise.all(
      snap.docs.map(async (d) => {
        const review = { id: d.id, ...d.data() };

        if (review.productId) {
          const productRef = doc(db, 'products', review.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) review.productInfo = productSnap.data();
        }

        if (review.mainAccountId) {
          const userRef = doc(db, 'users', review.mainAccountId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) review.mainAccountName = userSnap.data().name;
        }

        if (review.subAccountId) {
          const subAccountRef = doc(db, 'subAccounts', review.subAccountId);
          const subAccountSnap = await getDoc(subAccountRef);
          if (subAccountSnap.exists()) {
            const subAccountData = subAccountSnap.data();
            Object.assign(review, subAccountData);
            review.subAccountName = subAccountData.name;
          }
        }

        return review;
      })
    );

    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSettledList();
  }, []);

  const openDetailModal = (review) => {
    setSelectedReview(review);
    setIsModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsModalOpen(false);
    setSelectedReview(null);
  };

  if (loading) return <p>정산 완료 목록을 불러오는 중...</p>;

  return (
    <>
      <h2>정산 완료 ({rows.length})</h2>
      <div className="toolbar">{/* 조회만 가능 */}</div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>정산완료일</th>
              <th>리뷰 인증일</th>
              <th>상품명</th>
              <th>본계정 이름</th>
              <th>타계정 이름</th>
              <th>전화번호</th>
              <th>주문번호</th>
              <th>리뷰 인증</th>
              <th>정산 금액</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.settledAt?.seconds ? new Date(r.settledAt.seconds * 1000).toLocaleString() : ''}</td>
                <td>{r.verifiedAt?.seconds ? new Date(r.verifiedAt.seconds * 1000).toLocaleString() : ''}</td>
                <td>{r.productInfo?.productName || r.productName || '-'}</td>
                <td>{r.mainAccountName || '-'}</td>
                <td>{r.subAccountName || '-'}</td>
                <td>{r.phoneNumber || '-'}</td>
                <td>{r.orderNumber || '-'}</td>
                <td>
                  <button
                    className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`}
                    onClick={() => openDetailModal(r)}
                  >
                    {r.confirmImageUrls?.length > 0 ? 'O' : 'X'}
                  </button>
                </td>
                <td>{r.rewardAmount ? Number(r.rewardAmount).toLocaleString() + '원' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isModalOpen && <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />}
    </>
  );}