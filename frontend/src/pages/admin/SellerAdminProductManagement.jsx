// src/pages/admin/AdminProductManagement.jsx (UI/UX 최종 수정본)

import { useState, useEffect } from 'react';
import { db, collection, query, onSnapshot, doc, updateDoc, orderBy, writeBatch, increment } from '../../firebaseConfig';
import Papa from 'papaparse';

export default function AdminProductManagementPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellersMap, setSellersMap] = useState({});
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  
  // [추가] 필터링 및 검색을 위한 상태
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "campaigns"), orderBy("createdAt", "desc"));
    const unsubscribeCampaigns = onSnapshot(q, (snapshot) => {
      setCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

    return () => { unsubscribeCampaigns(); unsubSellers(); };
  }, []);

  // [추가] 필터링된 캠페인 목록
  const filteredCampaigns = campaigns.filter(c => {
    const statusMatch = statusFilter ? c.status === statusFilter : true;
    const searchMatch = searchTerm ? JSON.stringify(c).toLowerCase().includes(searchTerm.toLowerCase()) : true;
    return statusMatch && searchMatch;
  });
  
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredCampaigns.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
  };
  
  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'campaigns', id), { status: newStatus });
      alert(`캠페인 상태가 '${newStatus}'로 변경되었습니다.`);
    } catch (error) {
      console.error("상태 업데이트 오류:", error);
      alert("상태 업데이트에 실패했습니다.");
    }
  };

  const handleCancelBySellerFault = async (campaign) => {
    const { id, sellerUid, productPrice, quantity, itemTotal } = campaign;
    if (!sellerUid || productPrice === undefined || quantity === undefined || itemTotal === undefined) {
      return alert("필수 정보(판매자UID, 상품가, 수량, 총 견적)가 없어 처리할 수 없습니다.");
    }
    const cancelQtyStr = prompt(`취소할 수량을 입력하세요. (현재 수량: ${quantity}개)`, quantity.toString());
    if (cancelQtyStr === null || cancelQtyStr === "") return;
    const cancelQty = parseInt(cancelQtyStr, 10);
    if (isNaN(cancelQty) || cancelQty <= 0 || cancelQty > quantity) {
      return alert(`유효하지 않은 수량입니다. (1 ~ ${quantity} 사이)`);
    }

    const refundAmount = Number(productPrice) * cancelQty;
    const remainingQty = Number(quantity) - cancelQty;
    const confirmationMessage = `정말로 이 캠페인의 수량을 ${cancelQty}개 취소하시겠습니까?\n판매자에게 상품가 기준 ${refundAmount.toLocaleString()}원의 예치금이 적립됩니다.\n\n${remainingQty > 0 ? `캠페인의 남은 수량은 ${remainingQty}개가 됩니다.` : "캠페인이 전체 취소 처리됩니다."}`;
    
    if (!window.confirm(confirmationMessage)) return;

    const batch = writeBatch(db);
    const campaignDocRef = doc(db, 'campaigns', id);
    const sellerDocRef = doc(db, 'sellers', sellerUid);

    if (remainingQty > 0) {
      const unitServicePrice = (Number(itemTotal) / Number(quantity)) - Number(productPrice);
      const newItemTotal = (unitServicePrice + Number(productPrice)) * remainingQty;
      batch.update(campaignDocRef, { quantity: remainingQty, itemTotal: newItemTotal });
    } else {
      batch.update(campaignDocRef, { status: '판매자귀책취소' });
    }
    
    batch.update(sellerDocRef, { deposit: increment(refundAmount) });

    try {
      await batch.commit();
      alert("작업이 성공적으로 처리되었습니다.");
    } catch (error) {
      console.error("취소 및 예치금 적립 처리 중 오류:", error);
      alert("작업 처리 중 오류가 발생했습니다.");
    }
  };

  const handleTogglePayment = async (id, checked) => {
    try {
      await updateDoc(doc(db, 'campaigns', id), { depositConfirmed: checked });
    } catch (err) {
      console.error('입금 여부 업데이트 오류:', err);
    }
  };

  const handleDownloadExcel = () => {
    if (filteredCampaigns.length === 0) return alert("다운로드할 데이터가 없습니다.");
    const toText = (v) => `="${(v ?? '').toString()}"`;
    const dataForExcel = filteredCampaigns.map((c, index) => {
      const finalItemAmount = c.itemTotal ? Math.round(c.itemTotal * 1.10) : 0;
      const commission = c.itemTotal ? finalItemAmount - c.itemTotal : 0;
      return {
        '순번': index + 1,
        '상품 등록일시': c.createdAt?.seconds
          ? new Date(c.createdAt.seconds * 1000).toLocaleString('ko-KR')
          : '',
        '진행일자': c.date?.seconds
          ? new Date(c.date.seconds * 1000).toLocaleDateString('ko-KR')
          : '',
        '구분': c.deliveryType || '',
        '리뷰 종류': c.reviewType || '',
        '체험단 개수': c.quantity || '',
        '상품명': c.productName || '',
        '상품가': c.productPrice ? Number(c.productPrice).toLocaleString() : '',
        '옵션': c.productOption || '',
        '키워드': c.keywords || '',
        '상품 URL': c.productUrl || '',
        '상태': c.status || 'N/A',
        '닉네임': sellersMap[c.sellerUid]?.nickname || '',
        '전화번호': toText(sellersMap[c.sellerUid]?.phone || ''),
        '입금확인': c.depositConfirmed ? 'Y' : 'N',
        '견적 상세': `((리뷰 ${Number(c.basePrice || 0).toLocaleString()}${
          c.sundayExtraCharge > 0
            ? ` + 공휴일 ${Number(c.sundayExtraCharge).toLocaleString()}`
            : ''}) + 상품가 ${Number(c.productPrice).toLocaleString()}) * ${
          c.quantity
        }개`,
        '총 견적': `${finalItemAmount.toLocaleString()}원 (견적 ${Number(
          c.itemTotal || 0
        ).toLocaleString()} + 수수료 ${commission.toLocaleString()})`,
        '결제유형/상품종류/리뷰종류/리뷰인증': '자율결제/실배송/별점/X',
        '작업': '반려',
      };
    });
    const csv = Papa.unparse(dataForExcel);
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `캠페인_목록_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const thClass = "px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider";

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">캠페인 관리 ({filteredCampaigns.length})</h2>
        <div className="flex items-center space-x-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">선택 항목 인증</button>
            <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">삭제</button>
            <button onClick={handleDownloadExcel} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">엑셀 다운로드</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md overflow-x-auto">
        <div className="flex items-center space-x-4 mb-4">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-2 border border-gray-300 rounded-md">
                <option value="">전체 상태</option>
                <option value="미확정">미확정</option>
                <option value="예약 확정">예약 확정</option>
                <option value="구매완료">구매완료</option>
                <option value="리뷰완료">리뷰완료</option>
                <option value="판매자귀책취소">판매자귀책취소</option>
            </select>
            <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="p-2 border border-gray-300 rounded-md w-64"/>
        </div>

        {loading ? <p>캠페인 목록을 불러오는 중입니다...</p> : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className={thClass}><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.length === filteredCampaigns.length && filteredCampaigns.length > 0} /></th>
                <th className={thClass}>순번</th>
                <th className={thClass}>상품 등록일시</th>
                <th className={thClass}>진행일자</th>
                <th className={thClass}>구분</th>
                <th className={thClass}>리뷰 종류</th>
                <th className={thClass}>체험단 개수</th>
                <th className={thClass}>상품명</th>
                <th className={thClass}>상품가</th>
                <th className={thClass}>옵션</th>
                <th className={thClass}>키워드</th>
                <th className={thClass}>상품 URL</th>
                <th className={thClass}>상태</th>
                <th className={thClass}>닉네임</th>
                <th className={thClass}>전화번호</th>
                <th className={thClass}>입금확인</th>
                <th className={thClass}>견적 상세</th>
                <th className={thClass}>총 견적</th>
                <th className={thClass}>결제유형/상품종류/리뷰종류/리뷰인증</th>
                <th className={thClass}>작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {filteredCampaigns.map((c, index) => {
                  const finalItemAmount = c.itemTotal ? Math.round(c.itemTotal * 1.10) : 0;
                  const commission = c.itemTotal ? finalItemAmount - c.itemTotal : 0;
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleSelectOne(c.id)} /></td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{index + 1}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleString('ko-KR') : 'N/A'}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString('ko-KR') : '-'}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{c.deliveryType}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{c.reviewType}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{c.quantity}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.productName}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{Number(c.productPrice).toLocaleString()}원</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{c.productOption}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{c.keywords}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm"><a href={c.productUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">링크</a></td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === '리뷰완료' ? 'bg-blue-100 text-blue-800' : c.status === '예약 확정' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{c.status}</span></td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{sellersMap[c.sellerUid]?.nickname}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">{sellersMap[c.sellerUid]?.phone}</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm"><input type="checkbox" checked={!!c.depositConfirmed} onChange={(e) => handleTogglePayment(c.id, e.target.checked)} /></td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-xs text-gray-500">((리뷰 {Number(c.basePrice || 0).toLocaleString()}{c.sundayExtraCharge > 0 ? ` + 공휴일 ${Number(c.sundayExtraCharge).toLocaleString()}` : ''}) + 상품가 {Number(c.productPrice).toLocaleString()}) * {c.quantity}개</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm"><div className='font-bold'>{finalItemAmount.toLocaleString()}원</div><div className='text-xs text-gray-500'>(견적 {Number(c.itemTotal || 0).toLocaleString()} + 수수료 {commission.toLocaleString()})</div></td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm">자율결제/실배송/별점/X</td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium"><a href="#" className="text-indigo-600 hover:text-indigo-900">반려</a></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}