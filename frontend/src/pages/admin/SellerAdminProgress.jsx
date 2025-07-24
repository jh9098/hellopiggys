// src/pages/admin/AdminProgress.jsx

import { useEffect, useState, useMemo } from 'react';
import { db, collection, query, where, onSnapshot, updateDoc, doc } from '../../firebaseConfig';
import { toAbsoluteUrl } from '../../utils';
import { Button } from '@/components/ui/button';

export default function AdminProgressPage() {
  const [campaigns, setCampaigns] = useState([]);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0);
  const itemsPerPage = 100;
  const pagesPerGroup = 10;

  useEffect(() => {
    const q = query(collection(db, 'campaigns'), where('status', '==', '예약 확정'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("데이터 로딩 실패:", error); setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredCampaigns = campaigns
    .filter(c => {
      const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .sort((a, b) => {
      const getTime = (obj, field) => obj[field]?.seconds || new Date(obj[field]).getTime() / 1000 || 0;
      const aTime = getTime(a, 'confirmedAt') || getTime(a, 'createdAt');
      const bTime = getTime(b, 'confirmedAt') || getTime(b, 'createdAt');
      return (aTime - bTime) || (getTime(a, 'date') - getTime(b, 'date'));
    });

  const years = Array.from(new Set(campaigns.map(c => new Date(c.date?.seconds * 1000 || c.date).getFullYear()))).sort((a, b) => b - a);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const expandedCampaigns = filteredCampaigns.flatMap(c => Array.from({ length: Number(c.quantity) || 1 }, () => c));

  const paginatedCampaigns = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return expandedCampaigns.slice(startIndex, startIndex + itemsPerPage);
  }, [expandedCampaigns, currentPage]);

  const totalPages = Math.ceil(expandedCampaigns.length / itemsPerPage);
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);
  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

  const updatePaymentType = async (id, value) => {
    try {
      await updateDoc(doc(db, 'campaigns', id), { paymentType: value });
      const productId = campaigns.find(c => c.id === id)?.productId;
      if (productId) {
        await updateDoc(doc(db, 'products', productId), {
          paymentType: value,
          reviewType: value,
        });
      }
    } catch (err) {
      console.error('결제유형 업데이트 오류:', err);
      alert('결제유형 업데이트에 실패했습니다.');
    }
  };

  if (loading) return <p>진행 현황을 불러오는 중...</p>;

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
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              {['순번', '진행일자', '구분', '결제유형', '리뷰종류', '상품순', '상품명', '옵션', '상품가', '상품URL', '키워드', '리뷰어', '연락처', '주소', '주문번호', '택배사', '송장번호'].map(h => (
                <th key={h} className="px-2 py-2 text-left whitespace-nowrap font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paginatedCampaigns.map((c, idx) => {
              const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
              return (
                <tr key={`${c.id}-${idx}`} className="text-sm hover:bg-gray-50">
                  <td className="px-2 py-2">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td className="px-2 py-2">{d.toLocaleDateString()}</td>
                  <td className="px-2 py-2">{c.deliveryType}</td>
                  <td className="px-2 py-2">
                    <select value={c.paymentType || (c.isVatApplied ? '현영' : '자율결제')} onChange={e => updatePaymentType(c.id, e.target.value)} className="border p-1 rounded w-full">
                      <option value="">선택</option><option value="현영">현영</option><option value="자율결제">자율결제</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">{c.reviewType}</td>
                  <td className="px-2 py-2">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td className="px-2 py-2">{c.productName}</td>
                  <td className="px-2 py-2">{c.productOption}</td>
                  <td className="px-2 py-2">{Number(c.productPrice).toLocaleString()}</td>
                  <td className="px-2 py-2 break-all">{c.productUrl && <a href={toAbsoluteUrl(c.productUrl)} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">바로가기</a>}</td>
                  <td className="px-2 py-2">{c.keywords}</td>
                  <td className="px-2 py-2 text-gray-500">-</td>
                  <td className="px-2 py-2 text-gray-500">-</td>
                  <td className="px-2 py-2 text-gray-500">-</td>
                  <td className="px-2 py-2 text-gray-500">-</td>
                  <td className="px-2 py-2 text-gray-500">-</td>
                  <td className="px-2 py-2 text-gray-500">-</td>
                </tr>
              );
            })}
            {filteredCampaigns.length === 0 && (
              <tr><td colSpan="17" className="text-center py-4 text-gray-500">해당 월에 예약 확정된 캠페인이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <Button variant="outline" size="sm" onClick={prevGroup} disabled={pageGroup === 0}>{'<<'}</Button>
        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>{'<'}</Button>
        {Array.from({ length: Math.min(pagesPerGroup, totalPages - pageGroup * pagesPerGroup) }, (_, i) => {
          const pageNum = pageGroup * pagesPerGroup + i + 1;
          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => goToPage(pageNum)}
            >
              {pageNum}
            </Button>
          );
        })}
        <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>{'>'}</Button>
        <Button variant="outline" size="sm" onClick={nextGroup} disabled={(pageGroup + 1) * pagesPerGroup >= totalPages}>{'>>'}</Button>
      </div>
    </>
  );
}