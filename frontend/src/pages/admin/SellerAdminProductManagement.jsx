// src/pages/admin/AdminProductManagement.jsx (요청사항 반영 최종본)

import { useState, useEffect, useMemo } from 'react';
import { db, collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy, writeBatch, increment, serverTimestamp, getDoc, setDoc } from '../../firebaseConfig';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import '../../components/ReviewDetailModal.css';
import { toAbsoluteUrl } from '../../utils';

// [추가] 날짜 포맷팅을 위한 헬퍼 함수
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

const formatDate = (date) => {
  if (!date || !date.seconds) return 'N/A';
  const d = new Date(date.seconds * 1000);
  const pad = (num) => num.toString().padStart(2, '0');
  const year = d.getFullYear().toString().slice(-2);
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${year}.${month}.${day}`;
};


export default function AdminProductManagementPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sellersMap, setSellersMap] = useState({});
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [detailText, setDetailText] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [allowSameDay, setAllowSameDay] = useState(true);
  const itemsPerPage = 20;
  const pagesPerGroup = 10;

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

    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'config', 'reservation_settings'));
      if (snap.exists()) {
        setAllowSameDay(snap.data().allowSameDay !== false);
      }
    };
    fetchConfig();

    return () => { unsubscribeCampaigns(); unsubSellers(); };
  }, []);

  const filteredCampaigns = campaigns.filter(c => {
    const statusMatch = statusFilter ? c.status === statusFilter : true;
    const searchMatch = searchTerm ? JSON.stringify(c).toLowerCase().includes(searchTerm.toLowerCase()) : true;
    return statusMatch && searchMatch;
  });

  const getBasePrice = (deliveryType, reviewType) => {
    if (deliveryType === '실배송') {
      switch (reviewType) {
        case '별점': return 1600;
        case '텍스트': return 1700;
        case '포토': return 1800;
        case '프리미엄(포토)': return 4000;
        case '프리미엄(영상)': return 5000;
        default: return 0;
      }
    } else if (deliveryType === '빈박스') {
      return (reviewType === '별점' || reviewType === '텍스트') ? 5400 : 0;
    }
    return 0;
  };

  const computeAmounts = (c) => {
    const basePrice = getBasePrice(c.deliveryType, c.reviewType);
    const dateObj = c.date?.seconds ? new Date(c.date.seconds * 1000) : c.date ? new Date(c.date) : new Date();
    const sundayExtraCharge = dateObj.getDay() === 0 ? 600 : 0;
    const reviewFee = c.reviewFee ?? basePrice + sundayExtraCharge;
    const productPrice = Number(c.productPrice || 0);
    const productPriceWithAgency = c.productPriceWithAgencyFee ?? productPrice * 1.1;
    const quantity = Number(c.quantity || 0);
    const subtotal = (reviewFee + productPriceWithAgency) * quantity;
    const itemTotal = c.subtotal ?? c.itemTotal ?? Math.round(subtotal);
    const finalItemAmount = c.finalTotalAmount ?? c.finalItemAmount ?? Math.round((c.isVatApplied ? itemTotal * 1.1 : itemTotal));
    const commission = finalItemAmount - itemTotal;
    return { basePrice, sundayExtraCharge, reviewFee, productPrice, quantity, itemTotal, finalItemAmount, commission };
  };

  const requestSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const SortIndicator = ({ columnKey }) =>
    sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  const groupedAndPaginatedCampaigns = useMemo(() => {
    // 1. Grouping by createdAt timestamp (like in SellerReservation)
    const groups = {};
    filteredCampaigns.forEach((c) => {
        const key = c.createdAt?.seconds || c.id; // Fallback to id for old/malformed data
        if (!groups[key]) {
            groups[key] = {
                key,
                items: [],
                total: 0,
                createdAt: c.createdAt
            };
        }
        groups[key].items.push(c);
        const { finalItemAmount } = computeAmounts(c);
        groups[key].total += finalItemAmount;
    });

    // 2. Determine sort values and sort items when needed
    Object.values(groups).forEach(g => {
        if (sortConfig.key === 'date') {
            g.items.sort((a,b) => {
                const av = a.date?.seconds || 0;
                const bv = b.date?.seconds || 0;
                return sortConfig.direction === 'asc' ? av - bv : bv - av;
            });
            g.sortValue = g.items[0]?.date?.seconds || 0;
        } else {
            g.items.sort((a,b) => {
                const av = a.createdAt?.seconds || 0;
                const bv = b.createdAt?.seconds || 0;
                return sortConfig.direction === 'asc' ? av - bv : bv - av;
            });
            g.sortValue = g.createdAt?.seconds || 0;
        }
    });

    const sortedGroups = Object.values(groups).sort((a, b) =>
        sortConfig.direction === 'asc' ? a.sortValue - b.sortValue : b.sortValue - a.sortValue
    );

    // 3. Flatten the structure with group information
    const flattened = [];
    let groupCounter = 1;
    sortedGroups.forEach(group => {
        group.items.forEach((item, iIdx) => {
            flattened.push({
                ...item,
                groupInfo: {
                    isFirstInGroup: iIdx === 0,
                    size: group.items.length,
                    total: group.total,
                    id: group.key,
                    displayIndex: groupCounter,
                }
            });
        });
        groupCounter++;
    });

    // 4. Paginate the flattened list
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedFlattened = flattened.slice(startIndex, startIndex + itemsPerPage);

    // 5. Post-process the paginated list to calculate correct rowSpans for the current page
    const finalPaginatedItems = [];
    const processedGroupIdsOnPage = new Set();

    paginatedFlattened.forEach(item => {
        const { groupInfo } = item;
        let rowSpan = 0;
        let shouldRenderGroupCells = false;
        
        if (!processedGroupIdsOnPage.has(groupInfo.id)) {
            shouldRenderGroupCells = true;
            processedGroupIdsOnPage.add(groupInfo.id);
            rowSpan = paginatedFlattened.filter(pItem => pItem.groupInfo.id === groupInfo.id).length;
        }

        finalPaginatedItems.push({
            ...item,
            renderInfo: {
                shouldRender: shouldRenderGroupCells,
                rowSpan: rowSpan,
            }
        });
    });

    return finalPaginatedItems;
  }, [filteredCampaigns, currentPage, itemsPerPage, sortConfig]);

  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage);
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);
  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

  const handleToggleSameDay = async () => {
    const newVal = !allowSameDay;
    setAllowSameDay(newVal);
    await setDoc(doc(db, 'config', 'reservation_settings'), { allowSameDay: newVal }, { merge: true });
  };
  
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(groupedAndPaginatedCampaigns.map(c => c.id));
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

  const handleConfirmDeposit = async (campaignId, isChecked) => {
    if (!isChecked) {
        try {
            await updateDoc(doc(db, 'campaigns', campaignId), { depositConfirmed: false });
        } catch (err) {
            console.error('입금 확인 취소 오류:', err);
            alert("입금 확인 취소 중 오류가 발생했습니다.");
        }
        return;
    }

    if (window.confirm("이 캠페인의 입금을 확인하고 예약을 최종 확정하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) {
        try {
            const campaignRef = doc(db, 'campaigns', campaignId);
            const snap = await getDoc(campaignRef);
            const data = snap.data();

            let productId = data.productId;
            if (!productId) {
                const productRef = doc(collection(db, 'products'));
                productId = productRef.id;
                await setDoc(productRef, {
                    productName: data.productName || '',
                    productType: data.deliveryType || '',
                    reviewOption: data.reviewType || '',
                    quantity: data.quantity || 0,
                    productOption: data.productOption || '',
                    productPrice: data.productPrice || '',
                    keywords: data.keywords || '',
                    productUrl: data.productUrl || '',
                    reviewDate: data.date?.seconds
                      ? new Date(data.date.seconds * 1000)
                          .toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
                      : '',
                    guide: data.reviewGuide || '',
                    progressStatus: '진행전',
                    createdAt: serverTimestamp()
                });
                await updateDoc(campaignRef, { productId });
            } else {
                await updateDoc(doc(db, 'products', productId), {
                    guide: data.reviewGuide || ''
                });
            }

            await updateDoc(campaignRef, {
                status: '예약 확정',
                depositConfirmed: true,
                confirmedAt: serverTimestamp()
            });
            alert("캠페인이 '예약 확정' 상태로 변경되었습니다.");
        } catch (error) {
            console.error("예약 확정 처리 중 오류:", error);
            alert(`예약 확정 처리 중 오류가 발생했습니다: ${error.message}`);
        }
    }
  };

  const handleCancelReservation = async (campaignId) => {
    if (!window.confirm("이 캠페인의 예약 확정을 취소하고 '예약 대기' 상태로 되돌리시겠습니까?")) {
      return;
    }
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        status: '예약 대기',
        depositConfirmed: false,
      });
      alert("예약이 취소되어 '예약 대기' 상태로 변경되었습니다.");
    } catch (err) {
      console.error('예약 취소 오류:', err);
      alert("예약 취소 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return alert('삭제할 캠페인을 선택해주세요.');
    if (!window.confirm(`선택된 ${selectedIds.length}개의 캠페인을 삭제하시겠습니까?`)) return;
    try {
      for (const id of selectedIds) {
        await deleteDoc(doc(db, 'campaigns', id));
      }
      setCampaigns(prev => prev.filter(c => !selectedIds.includes(c.id)));
      setSelectedIds([]);
      alert('선택한 캠페인이 삭제되었습니다.');
    } catch (error) {
      console.error('캠페인 삭제 오류:', error);
      alert('캠페인 삭제 중 오류가 발생했습니다.');
    }
  };

  const openDetailModal = (text) => setDetailText(text);
  const closeDetailModal = () => setDetailText(null);

  const handleDownloadExcel = () => {
    if (filteredCampaigns.length === 0) return alert("다운로드할 데이터가 없습니다.");
    const toText = (v) => `="${(v ?? '').toString()}"`;
    const dataForExcel = filteredCampaigns.map((c, index) => {
      const { basePrice, sundayExtraCharge, productPrice, quantity, itemTotal, finalItemAmount, commission } = computeAmounts(c);
      return {
        '순번': index + 1,
        '예약 등록 일자': c.createdAt?.seconds ? new Date(c.createdAt.seconds * 1000).toLocaleDateString('ko-KR') : '',
        '진행일자': c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString('ko-KR') : '',
        '구분': c.deliveryType || '',
        '리뷰 종류': c.reviewType || '',
        '체험단 개수': c.quantity || '',
        '상품명': c.productName || '',
        '상품가': c.productPrice ? Number(c.productPrice).toLocaleString() : '',
        '옵션': c.productOption || '',
        '키워드': c.keywords || '',
        '상품 URL': toAbsoluteUrl(c.productUrl) || '',
        '상태': c.status || 'N/A',
        '닉네임': sellersMap[c.sellerUid]?.nickname || '',
        '전화번호': toText(sellersMap[c.sellerUid]?.phone || ''),
        '입금확인': c.depositConfirmed ? 'Y' : 'N',
        '개별견적': `${finalItemAmount.toLocaleString()}원`,
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
            <label className="flex items-center space-x-1 text-sm mr-4">
              <input type="checkbox" checked={allowSameDay} onChange={handleToggleSameDay} />
              <span>당일예약</span>
            </label>
            <Button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">선택 항목 인증</Button>
            <Button onClick={handleDeleteSelected} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">삭제</Button>
            <Button onClick={handleDownloadExcel} className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700">엑셀 다운로드</Button>
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
                <th className={thClass}><input type="checkbox" onChange={handleSelectAll} checked={groupedAndPaginatedCampaigns.length > 0 && groupedAndPaginatedCampaigns.every(c => selectedIds.includes(c.id))} /></th>
                <th className={thClass}>상품군</th>
                <th className={thClass}>순번</th>
                <th className={thClass + ' sortable'} onClick={() => requestSort('createdAt')}>
                  예약 등록 일자<SortIndicator columnKey="createdAt" />
                </th>
                <th className={thClass + ' sortable'} onClick={() => requestSort('date')}>
                  진행일자<SortIndicator columnKey="date" />
                </th>
                <th className={thClass}>구분</th>
                <th className={thClass}>리뷰 종류</th>
                <th className={thClass}>체험단 개수</th>
                <th className={thClass}>상품명</th>
                <th className={thClass}>옵션</th>
                <th className={thClass}>상품가</th>
                <th className={thClass}>키워드</th>
                <th className={thClass}>상품 URL</th>
                <th className={thClass}>상태</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-red-50">판매자<br/>입금체크</th>
                <th className={thClass}>닉네임</th>
                <th className={thClass}>전화번호</th>
                <th className={thClass}>입금확인<br/>(예약확정)</th>
                <th className={thClass}>개별견적</th>
                <th className={thClass}>결제금액</th>
                <th className={thClass}>작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {groupedAndPaginatedCampaigns.length === 0 ? (
                    <tr><td colSpan="21" className="text-center py-10">데이터가 없습니다.</td></tr>
                ) : (
                    groupedAndPaginatedCampaigns.map((c, index) => {
                      const { finalItemAmount } = computeAmounts(c);
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleSelectOne(c.id)} /></td>
                          
                          {c.renderInfo.shouldRender && (
                            <td rowSpan={c.renderInfo.rowSpan} className="px-3 py-4 whitespace-nowrap text-sm text-center align-middle font-semibold">{`상품군 ${c.groupInfo.displayIndex}`}</td>
                          )}

                          <td className="px-3 py-4 whitespace-nowrap text-sm">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{formatDate(c.createdAt)}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500">{c.date?.seconds ? new Date(c.date.seconds * 1000).toLocaleDateString('ko-KR') : '-'}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{c.deliveryType}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{c.reviewType}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{c.quantity}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{c.productName}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{c.productOption}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{Number(c.productPrice).toLocaleString()}원</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{c.keywords}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm"><a href={toAbsoluteUrl(c.productUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">링크</a></td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${c.status === '리뷰완료' ? 'bg-blue-100 text-blue-800' : c.status === '예약 확정' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{c.status}</span>
                            {c.status === '예약 확정' && (
                              <button onClick={() => handleCancelReservation(c.id)} className="ml-2 text-red-600 underline text-xs">취소</button>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-center bg-red-50">{c.paymentReceived ? '✔️' : ''}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{sellersMap[c.sellerUid]?.nickname}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{sellersMap[c.sellerUid]?.phone}</td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                            <input 
                                type="checkbox" 
                                checked={!!c.depositConfirmed} 
                                onChange={(e) => handleConfirmDeposit(c.id, e.target.checked)} 
                                disabled={c.status === '예약 확정'}
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">{finalItemAmount.toLocaleString()}원</td>
                          
                          {c.renderInfo.shouldRender && (
                             <td rowSpan={c.renderInfo.rowSpan} className="px-3 py-4 whitespace-nowrap text-sm text-right align-middle font-semibold">{c.groupInfo.total.toLocaleString()}원</td>
                          )}

                          <td className="px-3 py-4 whitespace-nowrap text-sm font-medium"><a href="#" className="text-indigo-600 hover:text-indigo-900">반려</a></td>
                        </tr>
                      );
                    })
                )}
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
      {detailText && (
        <div className="modal-back" onClick={closeDetailModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={closeDetailModal}>✖</button>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{detailText}</pre>
          </div>
        </div>
      )}
    </>
  );
}