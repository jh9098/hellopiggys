// src/pages/seller/SellerProgress.jsx (Vite 환경에 맞게 수정된 최종본)

import { useEffect, useState } from 'react';
import { db, auth, onAuthStateChanged, collection, query, where, onSnapshot } from '../../firebaseConfig';

export default function SellerProgressPage() {
  const [user, setUser] = useState(null); // 현재 사용자 정보
  const [campaigns, setCampaigns] = useState([]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Firebase Auth 상태 리스너
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setCampaigns([]); // 사용자가 없으면 캠페인 목록 초기화
      return;
    }
    
    // Firestore 실시간 리스너
    const q = query(
      collection(db, 'campaigns'),
      where('sellerUid', '==', user.uid),
      where('status', '==', '예약 확정')
    );
    const unsubscribeFirestore = onSnapshot(q, (snap) => {
      const fetchedCampaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCampaigns(fetchedCampaigns);
    }, (error) => {
      console.error("캠페인 데이터 로딩 실패:", error);
    });

    return () => unsubscribeFirestore(); // 컴포넌트 언마운트 시 리스너 정리
  }, [user]);

  const filteredCampaigns = campaigns
    .filter(c => {
      const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .sort((a, b) => {
      const getTime = (obj, field) => {
        const val = obj[field];
        if (!val) return 0;
        if (val.seconds) return val.seconds;
        return new Date(val).getTime() / 1000;
      };
      const aConfirm = getTime(a, 'confirmedAt') || getTime(a, 'createdAt');
      const bConfirm = getTime(b, 'confirmedAt') || getTime(b, 'createdAt');
      if (aConfirm !== bConfirm) return aConfirm - bConfirm;
      const aDate = getTime(a, 'date');
      const bDate = getTime(b, 'date');
      return aDate - bDate;
    });

  const years = Array.from(new Set(campaigns.map(c => {
    const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
    return d.getFullYear();
  }))).sort();

  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  
  const expandedCampaigns = filteredCampaigns.flatMap(c => {
    const qty = Number(c.quantity) || 1;
    return Array.from({ length: qty }, () => c);
  });

  if (isLoading) {
    return <p>로딩 중...</p>;
  }

  return (
    <>
      <div className="flex items-center mb-4 space-x-2">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border p-1 rounded">
          {years.length === 0 ? <option>{year}</option> : years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border p-1 rounded">
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <h2 className="text-2xl font-bold ml-4">진행현황</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow text-sm">
          <thead className="bg-gray-100">
            <tr>
              {['순번', '진행일자', '구분', '결제유형', '리뷰종류', '상품순', '상품명', '옵션', '상품가', '상품URL', '키워드', '리뷰어', '연락처', '주소', '주문번호', '택배사', '송장번호'].map(h => (
                <th key={h} className="px-2 py-2 text-left whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {expandedCampaigns.map((c, idx) => {
              const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
              return (
                <tr key={`${c.id}-${idx}`} className="text-sm">
                  <td className="px-2 py-2">{idx + 1}</td>
                  <td className="px-2 py-2">{d.toLocaleDateString()}</td>
                  <td className="px-2 py-2">{c.deliveryType}</td>
                  <td className="px-2 py-2">{c.paymentType || '-'}</td>
                  <td className="px-2 py-2">{c.reviewType}</td>
                  <td className="px-2 py-2">{idx + 1}</td>
                  <td className="px-2 py-2">{c.productName}</td>
                  <td className="px-2 py-2">{c.productOption}</td>
                  <td className="px-2 py-2">{Number(c.productPrice).toLocaleString()}</td>
                  <td className="px-2 py-2 break-all"><a href={c.productUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">바로가기</a></td>
                  <td className="px-2 py-2">{c.keywords}</td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-2 py-2">-</td>
                  <td className="px-2 py-2">-</td>
                </tr>
              );
            })}
            {filteredCampaigns.length === 0 && (
              <tr><td colSpan="17" className="text-center py-4 text-gray-500">등록된 캠페인이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}