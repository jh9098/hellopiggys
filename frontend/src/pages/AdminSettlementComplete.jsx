import { useEffect, useState } from 'react';
import { db, collection, getDocs, query, orderBy, where } from '../firebaseConfig';

export default function AdminSettlementComplete() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchSettledList = async () => {
      setLoading(true);
      const q = query(collection(db, 'reviews'), where('status', '==', 'settled'), orderBy('settledAt', 'desc'));
      const snap = await getDocs(q);
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchSettledList();
  }, []);

  if (loading) return <p>정산 완료 목록을 불러오는 중...</p>;

  return (
    <>
      <h2>정산 완료 ({rows.length})</h2>
      <div className="toolbar">
        {/* 이 페이지에서는 주로 조회만 하므로 버튼이 적음 */}
      </div>
      <table>
        <thead>
          <tr>
            <th>순번</th>
            <th>정산완료</th>
            <th>리뷰 제목</th>
            <th>상품명</th>
            <th>이미지</th>
            <th>전체/리뷰</th>
            <th>이름</th>
            <th>전화번호</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.id}>
              <td>{idx + 1}</td>
              <td>{r.settledAt?.seconds ? new Date(r.settledAt.seconds * 1000).toLocaleString() : ''}</td>
              <td>{r.title}</td>
              <td>{r.productName || '-'}</td>
              <td>{r.confirmImageUrls && r.confirmImageUrls.length > 0 ? '✓' : '✗'}</td>
              <td>0/0</td>
              <td>{r.name}</td>
              <td>{r.phoneNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}