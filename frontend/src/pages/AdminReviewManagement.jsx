// src/pages/AdminReviewManagement.jsx (상품 관리 시스템에 맞게 수정)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, updateDoc, doc, where, serverTimestamp, getDoc } from '../firebaseConfig';
import Papa from 'papaparse';
import ReviewDetailModal from '../components/ReviewDetailModal';

const getStatusText = (status) => {
  switch (status) {
    case 'review_completed': return '리뷰 완료';
    case 'rejected': return '반려됨';
    case 'submitted':
    default: return '구매 완료';
  }
};

export default function AdminReviewManagement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [filterCompleted, setFilterCompleted] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    const q = query(collection(db, 'reviews'), where('status', 'in', ['submitted', 'review_completed', 'rejected']), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    
    const reviewsData = await Promise.all(snap.docs.map(async (d) => {
      const review = { id: d.id, ...d.data() };

      // 본계정 이름 조회
      if (review.mainAccountId) {
        const userDocRef = doc(db, 'users', review.mainAccountId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          review.mainAccountName = userDocSnap.data().name; 
        }
      }
      
      // 타계정 정보 조회 (subAccountId 사용)
      if (review.subAccountId) {
          const subAccountRef = doc(db, "subAccounts", review.subAccountId);
          const subAccountSnap = await getDoc(subAccountRef);
          if(subAccountSnap.exists()){
              // 상세 모달 및 테이블 표시를 위해 필요한 정보들을 review 객체에 합친다.
              const subData = subAccountSnap.data();
              review.name = subData.name; // 타계정 이름 (수취인)
              review.phoneNumber = subData.phoneNumber;
              review.address = subData.address;
              review.bank = subData.bank;
              review.bankNumber = subData.bankNumber;
              review.accountHolderName = subData.accountHolderName;
          }
      }
      
      return review;
    }));
    
    setRows(reviewsData);
    setLoading(false);
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const filteredRows = useMemo(() => {
    let tempRows = [...rows];

    if (filterCompleted) {
      tempRows = tempRows.filter(r => r.confirmImageUrls && r.confirmImageUrls.length > 0);
    }

    if (search) {
      const s = search.toLowerCase();
      tempRows = tempRows.filter((r) =>
        [
          r.productName, // 상품명으로 검색
          r.reviewType,  // 리뷰 종류로 검색
          r.mainAccountName, // 본계정 이름
          r.name, // 타계정 이름
          r.phoneNumber, 
        ].filter(Boolean).join(' ').toLowerCase().includes(s)
      );
    }
    
    return tempRows;
  }, [rows, search, filterCompleted]);

  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  };

  const toggleSelectAll = (e) => {
    if (e.target.checked) setSelected(new Set(filteredRows.map((r) => r.id)));
    else setSelected(new Set());
  };

  const handleVerify = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`${selected.size}개의 항목을 리뷰 인증 처리하고 정산내역으로 넘기시겠습니까?`)) return;
    for (const id of selected) {
      await updateDoc(doc(db, 'reviews', id), { status: 'verified', verifiedAt: serverTimestamp() });
    }
    alert('리뷰 인증이 완료되었습니다.');
    setRows(rows.filter(r => !selected.has(r.id)));
    setSelected(new Set());
  };

  const handleReject = async (id) => {
    const reason = prompt("반려 사유를 입력하세요:");
    if (reason === null || !reason.trim()) {
      if(reason !== null) alert("반려 사유를 반드시 입력해야 합니다.");
      return;
    }
    if (window.confirm(`이 리뷰를 반려 처리하시겠습니까?\n사유: ${reason}`)) {
      await updateDoc(doc(db, 'reviews', id), { status: 'rejected', rejectionReason: reason.trim(), rejectedAt: serverTimestamp() });
      alert('리뷰가 반려 처리되었습니다.');
      await fetchReviews();
    }
  };

  const downloadCsv = () => {
    const csvData = filteredRows.map((r, i) => ({
      '순번': i + 1,
      '등록일시': r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : '',
      '상품명': r.productName || '-',
      '리뷰 종류': r.reviewType || '-',
      '본계정 이름': r.mainAccountName || '-',
      '타계정 이름': r.name || '-',
      '전화번호': r.phoneNumber || '-',
      '리뷰 제출': r.confirmImageUrls && r.confirmImageUrls.length > 0 ? 'O' : 'X',
    }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reviews_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const openDetailModal = (review) => {
    setSelectedReview(review);
    setIsModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsModalOpen(false);
    setSelectedReview(null);
  };

  if (loading) return <p>리뷰 정보를 불러오는 중...</p>;

  return (
    <>
      <h2>리뷰 관리 ({filteredRows.length})</h2>
      <div className="toolbar">
        <button onClick={handleVerify} disabled={selected.size === 0}>선택 항목 리뷰 인증</button>
        <button 
          onClick={() => setFilterCompleted(!filterCompleted)}
          style={{ backgroundColor: filterCompleted ? '#28a745' : '#fff', color: filterCompleted ? '#fff' : '#333' }}
        >
          리뷰 확인 'O'만 보기
        </button>
        <input placeholder="검색" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button onClick={downloadCsv}>엑셀 다운로드</button>
      </div>
      <table>
        <thead>
          <tr>
            <th><input type="checkbox" checked={selected.size === filteredRows.length && filteredRows.length > 0} onChange={toggleSelectAll} /></th>
            <th>등록일시</th>
            <th>상태</th>
            <th>상품명</th>
            <th>리뷰 종류</th>
            <th>본계정 이름</th>
            <th>타계정 이름</th>
            <th>전화번호</th>
            <th>리뷰 확인</th>            
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((r) => (
            <tr key={r.id}>
              <td><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
              <td>{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : ''}</td>
              <td>{getStatusText(r.status)}</td>
              <td>{r.productName || '-'}</td>
              <td>{r.reviewType || '-'}</td>
              <td>{r.mainAccountName || '-'}</td>
              <td>{r.name || '-'}</td>
              <td>{r.phoneNumber || '-'}</td>
              <td>
                <button className={`link-button ${r.confirmImageUrls?.length > 0 ? 'completed' : ''}`} onClick={() => openDetailModal(r)}>
                  {r.confirmImageUrls?.length > 0 ? 'O' : 'X'}
                </button>
              </td>
              <td>
                <button onClick={() => handleReject(r.id)} className="reject-button">반려</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {isModalOpen && (
        <ReviewDetailModal review={selectedReview} onClose={closeDetailModal} />
      )}
    </>
  );
}