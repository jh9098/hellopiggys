import { useEffect, useState, useMemo } from 'react';
import { db, collection, query, where, onSnapshot } from '../../firebaseConfig';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const formatDateTime = (ts) => {
  if (!ts || !ts.seconds) return '';
  return new Date(ts.seconds * 1000).toLocaleString('ko-KR');
};

const formatDate = (ts) => {
  if (!ts || !ts.seconds) return '';
  return new Date(ts.seconds * 1000).toLocaleDateString('ko-KR');
};

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
  const dateObj = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date || Date.now());
  const sundayExtraCharge = dateObj.getDay() === 0 ? 600 : 0;
  const reviewFee = c.reviewFee ?? basePrice + sundayExtraCharge;
  const productPrice = Number(c.productPrice || 0);
  const productPriceWithAgency = c.productPriceWithAgencyFee ?? productPrice * 1.1;
  const quantity = Number(c.quantity || 0);
  const subtotal = (reviewFee + productPriceWithAgency) * quantity;
  const itemTotal = c.subtotal ?? c.itemTotal ?? Math.round(subtotal);
  const finalItemAmount = c.finalTotalAmount ?? c.finalItemAmount ?? Math.round((c.isVatApplied ? itemTotal * 1.1 : itemTotal));
  const commission = finalItemAmount - itemTotal;
  return { basePrice, sundayExtraCharge, productPrice, quantity, itemTotal, finalItemAmount, commission };
};

export default function SellerAdminDashboardPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [sellers, setSellers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'asc' });
  const [filters, setFilters] = useState({
    createdAt: '',
    date: '',
    deliveryType: '',
    reviewType: '',
    quantity: '',
    productName: '',
    productOption: '',
    productPrice: '',
    keywords: '',
    nickname: '',
    phone: '',
  });

  useEffect(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate()+1);

    const campaignUnsub = onSnapshot(
      query(collection(db, 'campaigns'), where('status', '==', '예약 확정')),
      (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const filtered = list.filter(c => {
          const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
          return d >= today && d < tomorrow;
        });
        setCampaigns(filtered);
        setLoading(false);
      },
      (err) => { console.error('캠페인 로딩 오류:', err); setLoading(false); }
    );

    const sellerUnsub = onSnapshot(collection(db, 'sellers'), (snap) => {
      const map = {};
      snap.forEach(doc => {
        const data = doc.data();
        if (data.uid) map[data.uid] = { nickname: data.nickname || '닉네임 없음', phone: data.phone || '-' };
      });
      setSellers(map);
    });

    return () => { campaignUnsub(); sellerUnsub(); };
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) setSelectedIds(sortedCampaigns.map(c => c.id));
    else setSelectedIds([]);
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }));
  };

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const sellerInfo = sellers[c.sellerUid] || {};
      return Object.entries(filters).every(([k,v]) => {
        if (!v) return true;
        let field = '';
        switch(k){
          case 'createdAt': field = formatDateTime(c.createdAt); break;
          case 'date': field = formatDate(c.date); break;
          case 'nickname': field = sellerInfo.nickname; break;
          case 'phone': field = sellerInfo.phone; break;
          default: field = c[k];
        }
        return String(field || '').toLowerCase().includes(String(v).toLowerCase());
      });
    });
  }, [campaigns, filters, sellers]);

  const sortedCampaigns = useMemo(() => {
    const list = [...filteredCampaigns];
    list.sort((a,b) => {
      let av = 0, bv = 0;
      if (sortConfig.key === 'createdAt') {
        av = a.createdAt?.seconds || 0;
        bv = b.createdAt?.seconds || 0;
      } else if (sortConfig.key === 'date') {
        av = a.date?.seconds || 0;
        bv = b.date?.seconds || 0;
      }
      return sortConfig.direction === 'asc' ? av - bv : bv - av;
    });
    return list;
  }, [filteredCampaigns, sortConfig]);

  const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  return (
    <Card>
      <CardHeader>
        <CardTitle>오늘의 캠페인</CardTitle>
        <CardDescription>예약 확정된 캠페인 중 오늘 진행되는 목록입니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px] text-center"><input type="checkbox" onChange={handleSelectAll} checked={sortedCampaigns.length > 0 && sortedCampaigns.every(c => selectedIds.includes(c.id))} /></TableHead>
              <TableHead className="w-[40px] text-center">#</TableHead>
              <TableHead className="w-[140px] cursor-pointer" onClick={() => requestSort('createdAt')}>예약 등록 일시<SortIndicator columnKey="createdAt" /></TableHead>
              <TableHead className="w-[100px] cursor-pointer" onClick={() => requestSort('date')}>진행일자<SortIndicator columnKey="date" /></TableHead>
              <TableHead className="w-[80px] text-center">구분</TableHead>
              <TableHead className="w-[100px] text-center">리뷰 종류</TableHead>
              <TableHead className="w-[80px] text-center">수량</TableHead>
              <TableHead>상품명</TableHead>
              <TableHead>옵션</TableHead>
              <TableHead className="w-[120px] text-right">상품가</TableHead>
              <TableHead>키워드</TableHead>
              <TableHead>닉네임</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead className="w-[120px]">총 견적</TableHead>
            </TableRow>
            <TableRow>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead><input className="w-full" value={filters.createdAt} onChange={e=>handleFilterChange('createdAt', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.date} onChange={e=>handleFilterChange('date', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.deliveryType} onChange={e=>handleFilterChange('deliveryType', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.reviewType} onChange={e=>handleFilterChange('reviewType', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.quantity} onChange={e=>handleFilterChange('quantity', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.productName} onChange={e=>handleFilterChange('productName', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.productOption} onChange={e=>handleFilterChange('productOption', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.productPrice} onChange={e=>handleFilterChange('productPrice', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.keywords} onChange={e=>handleFilterChange('keywords', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.nickname} onChange={e=>handleFilterChange('nickname', e.target.value)} /></TableHead>
              <TableHead><input className="w-full" value={filters.phone} onChange={e=>handleFilterChange('phone', e.target.value)} /></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">데이터를 불러오는 중...</TableCell>
              </TableRow>
            ) : sortedCampaigns.length > 0 ? (
              sortedCampaigns.map((c, idx) => {
                const { finalItemAmount } = computeAmounts(c);
                return (
                  <TableRow key={c.id} data-state={selectedIds.includes(c.id) ? 'selected' : undefined}>
                    <TableCell className="text-center"><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => handleSelectOne(c.id)} /></TableCell>
                    <TableCell className="text-center">{idx + 1}</TableCell>
                    <TableCell>{formatDateTime(c.createdAt)}</TableCell>
                    <TableCell>{formatDate(c.date)}</TableCell>
                    <TableCell className="text-center">{c.deliveryType}</TableCell>
                    <TableCell className="text-center">{c.reviewType}</TableCell>
                    <TableCell className="text-center">{c.quantity}</TableCell>
                    <TableCell className="font-medium">{c.productName}</TableCell>
                    <TableCell>{c.productOption}</TableCell>
                    <TableCell className="text-right">{Number(c.productPrice).toLocaleString()}원</TableCell>
                    <TableCell>{c.keywords}</TableCell>
                    <TableCell>{sellers[c.sellerUid]?.nickname}</TableCell>
                    <TableCell>{sellers[c.sellerUid]?.phone}</TableCell>
                    <TableCell className="text-right font-semibold">{finalItemAmount.toLocaleString()}원</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">오늘 진행되는 캠페인이 없습니다.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
