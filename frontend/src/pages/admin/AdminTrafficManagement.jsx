// src/pages/admin/AdminTrafficManagement.jsx (신규 파일)

import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, doc, updateDoc, orderBy, serverTimestamp } from '../../firebaseConfig';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';

// 날짜 포맷팅 헬퍼 함수
const formatDateTime = (date) => {
  if (!date || !date.seconds) return 'N/A';
  const d = new Date(date.seconds * 1000);
  const pad = (num) => num.toString().padStart(2, '0');
  
  const year = d.getFullYear().toString().slice(-2);
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${year}.${month}.${day} ${hours}:${minutes}:${seconds}`;
};

export default function AdminTrafficManagementPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellersMap, setSellersMap] = useState({});
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0);
  const itemsPerPage = 20;
  const pagesPerGroup = 10;

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "traffic_requests"), orderBy("createdAt", "desc"));
    const unsubscribeRequests = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubSellers = onSnapshot(collection(db, 'sellers'), (snap) => {
      const map = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.uid) {
          map[data.uid] = {
            nickname: data.nickname || '닉네임 없음',
            phone: data.phone || '-'
          };
        }
      });
      setSellersMap(map);
    });

    return () => { unsubscribeRequests(); unsubSellers(); };
  }, []);

  const filteredRequests = requests.filter(r => {
    const statusMatch = statusFilter ? r.status === statusFilter : true;
    const searchMatch = searchTerm ? JSON.stringify(r).toLowerCase().includes(searchTerm.toLowerCase()) : true;
    return statusMatch && searchMatch;
  });

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRequests, currentPage]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);
  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

  const handleConfirmDeposit = async (requestId, isChecked) => {
    if (!isChecked) {
      try {
        await updateDoc(doc(db, 'traffic_requests', requestId), { depositConfirmed: false });
      } catch (err) {
        console.error('입금 확인 취소 오류:', err);
      }
      return;
    }
    if (window.confirm("이 트래픽 요청의 입금을 확인하고 예약을 최종 확정하시겠습니까?")) {
      try {
        await updateDoc(doc(db, 'traffic_requests', requestId), {
          status: '예약 확정',
          depositConfirmed: true,
          confirmedAt: serverTimestamp()
        });
        alert("트래픽 요청이 '예약 확정' 상태로 변경되었습니다.");
      } catch (error) {
        console.error("예약 확정 처리 중 오류:", error);
      }
    }
  };

  const handleCancelReservation = async (requestId) => {
    if (!window.confirm("이 트래픽 예약 확정을 취소하고 '예약 대기' 상태로 되돌리시겠습니까?")) {
      return;
    }
    try {
      await updateDoc(doc(db, 'traffic_requests', requestId), {
        status: '예약 대기',
        depositConfirmed: false,
      });
      alert("예약이 취소되어 '예약 대기' 상태로 변경되었습니다.");
    } catch (err) {
      console.error('예약 취소 오류:', err);
      alert('예약 취소 중 오류가 발생했습니다.');
    }
  };

  const thClass = "px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">트래픽 요청 관리 ({filteredRequests.length})</h2>
      </div>
      <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
        <div className="flex items-center space-x-4 mb-4">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border border-gray-300 rounded-md">
            <option value="">전체 상태</option>
            <option value="미확정">미확정</option>
            <option value="예약 확정">예약 확정</option>
          </select>
          <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border border-gray-300 rounded-md w-64"/>
        </div>
        {loading ? <p>요청 목록을 불러오는 중입니다...</p> : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}>요청 등록 일시</th>
                <th className={thClass}>요청일자</th>
                <th className={thClass}>상품명</th>
                <th className={thClass}>개수</th>
                <th className={thClass}>상태</th>
                <th className={thClass}>닉네임</th>
                <th className={thClass}>전화번호</th>
                <th className={`${thClass} bg-red-50`}>판매자<br/>입금체크</th>
                <th className={thClass}>입금확인<br/>(예약확정)</th>
                <th className={thClass}>총 견적</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRequests.map(req => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{formatDateTime(req.createdAt)}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{req.requestDate?.seconds ? new Date(req.requestDate.seconds * 1000).toLocaleDateString('ko-KR') : '-'}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">{req.name}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">{req.quantity}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${req.status === '예약 확정' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{req.status}</span>
                    {req.status === '예약 확정' && (
                      <button
                        onClick={() => handleCancelReservation(req.id)}
                        className="ml-2 text-red-600 underline text-xs"
                      >취소</button>
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">{sellersMap[req.sellerUid]?.nickname}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">{sellersMap[req.sellerUid]?.phone}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-center bg-red-50">{req.paymentReceived ? '✔️' : ''}</td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm">
                    <input 
                      type="checkbox" 
                      checked={!!req.depositConfirmed} 
                      onChange={(e) => handleConfirmDeposit(req.id, e.target.checked)} 
                      disabled={req.status === '예약 확정'}
                    />
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold">{req.finalItemAmount?.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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