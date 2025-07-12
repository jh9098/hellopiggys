// src/pages/seller/SellerProgress.jsx (레이아웃 수정 및 UI 개선 최종본)

import { useEffect, useState } from 'react';
import { db, auth, onAuthStateChanged, collection, query, where, onSnapshot } from '../../firebaseConfig';

export default function SellerProgressPage() {
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setCampaigns([]);
      return;
    }
    
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

    return () => unsubscribeFirestore();
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
      return (aConfirm - bConfirm) || (getTime(a, 'date') - getTime(b, 'date'));
    });

  const years = Array.from(new Set(campaigns.map(c => new Date(c.date?.seconds * 1000 || c.date).getFullYear()))).sort((a, b) => b - a);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  
  const expandedCampaigns = filteredCampaigns.flatMap(c => Array.from({ length: Number(c.quantity) || 1 }, () => c));

  if (isLoading) {
    return <p>로딩 중...</p>;
  }

  return (
    <>
      <div className="flex items-center mb-4 space-x-2">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="border p-2 rounded-md">
          {years.length === 0 ? <option>{year}</option> : years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border p-2 rounded-md">
          {months.map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
        <h2 className="text-2xl font-bold ml-4">진행현황</h2>
      </div>
      <div className="overflow-x-auto bg-white rounded-lg shadow-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {['순번', '진행일자', '구분', '결제유형', '리뷰종류', '상품순', '상품명', '옵션', '상품가', '상품URL', '키워드', '리뷰어', '연락처', '주소', '주문번호', '택배사', '송장번호'].map(h => (
                <th key={h} className="px-3 py-3 text-left whitespace-nowrap font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {expandedCampaigns.length > 0 ? expandedCampaigns.map((c, idx) => {
              const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
              return (
                <tr key={`${c.id}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-3 py-3">{idx + 1}</td>
                  <td className="px-3 py-3">{d.toLocaleDateString()}</td>
                  <td className="px-3 py-3">{c.deliveryType}</td>
                  <td className="px-3 py-3">{c.paymentType || '-'}</td>
                  <td className="px-3 py-3">{c.reviewType}</td>
                  <td className="px-3 py-3">{idx + 1}</td>
                  <td className="px-3 py-3 font-medium text-gray-900">{c.productName}</td>
                  <td className="px-3 py-3">{c.productOption}</td>
                  <td className="px-3 py-3">{Number(c.productPrice).toLocaleString()}</td>
                  <td className="px-3 py-3 break-all"><a href={c.productUrl} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">바로가기</a></td>
                  <td className="px-3 py-3">{c.keywords}</td>
                  <td className="px-3 py-3 text-gray-500">-</td>
                  <td className="px-3 py-3 text-gray-500">-</td>
                  <td className="px-3 py-3 text-gray-500">-</td>
                  <td className="px-3 py-3 text-gray-500">-</td>
                  <td className="px-3 py-3 text-gray-500">-</td>
                  <td className="px-3 py-3 text-gray-500">-</td>
                </tr>
              );
            }) : (
              <tr><td colSpan="17" className="text-center py-10 text-gray-500">해당 월에 진행 예정인 캠페인이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}