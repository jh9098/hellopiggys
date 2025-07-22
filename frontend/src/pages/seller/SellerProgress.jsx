// src/pages/seller/SellerProgress.jsx (디자인 개선 버전)

import { useEffect, useState } from 'react';
import { db, auth, onAuthStateChanged, collection, query, where, onSnapshot } from '../../firebaseConfig';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button'; // 링크를 버튼처럼 보이게 하기 위해
import { toAbsoluteUrl } from '../../utils';

export default function SellerProgressPage() {
  // ... (기존 state 및 useEffect 로직은 동일)
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setCampaigns([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const q = query(
      collection(db, 'campaigns'),
      where('sellerUid', '==', user.uid),
      where('status', '==', '예약 확정')
    );
    const unsubscribeFirestore = onSnapshot(q, (snap) => {
      setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error("캠페인 데이터 로딩 실패:", error);
      setIsLoading(false);
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
        return val.seconds ? val.seconds : new Date(val).getTime() / 1000;
      };
      const aTime = getTime(a, 'confirmedAt') || getTime(a, 'createdAt');
      const bTime = getTime(b, 'confirmedAt') || getTime(b, 'createdAt');
      return (aTime - bTime) || (getTime(a, 'date') - getTime(b, 'date'));
    });

  const availableYears = Array.from(new Set(campaigns.map(c => new Date(c.date?.seconds * 1000 || c.date).getFullYear()))).sort((a,b) => b-a);
  if (availableYears.length === 0) availableYears.push(today.getFullYear());
  
  const availableMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  const expandedCampaigns = filteredCampaigns.flatMap(c => Array.from({ length: Number(c.quantity) || 1 }, () => c));


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>진행 현황</CardTitle>
          <CardDescription className="mt-1">
            월별로 확정된 캠페인의 진행 현황을 확인합니다.
          </CardDescription>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="연도 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent>
              {availableMonths.map(m => <SelectItem key={m} value={String(m)}>{m}월</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px] text-center">순번</TableHead>
                <TableHead className="w-[120px]">진행일자</TableHead>
                <TableHead className="w-[100px] text-center">구분</TableHead>
                <TableHead className="w-[100px] text-center">결제유형</TableHead>
                <TableHead className="w-[120px] text-center">리뷰종류</TableHead>
                <TableHead className="w-[60px] text-center">상품순</TableHead>
                <TableHead>상품명</TableHead>
                <TableHead>옵션</TableHead>
                <TableHead className="w-[120px] text-right">상품가</TableHead>
                <TableHead className="w-[100px] text-center">상품URL</TableHead>
                <TableHead>키워드</TableHead>
                <TableHead>리뷰어</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>주소</TableHead>
                <TableHead>주문번호</TableHead>
                <TableHead>택배사</TableHead>
                <TableHead>송장번호</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={17} className="h-48 text-center text-muted-foreground">
                    데이터를 불러오는 중입니다...
                  </TableCell>
                </TableRow>
              ) : expandedCampaigns.length > 0 ? (
                expandedCampaigns.map((c, idx) => {
                  const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
                  return (
                    <TableRow key={`${c.id}-${idx}`}>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="font-mono">{d.toLocaleDateString()}</TableCell>
                      <TableCell className="text-center"><Badge variant="outline">{c.deliveryType}</Badge></TableCell>
                      <TableCell className="text-center">{c.paymentType || '-'}</TableCell>
                      <TableCell className="text-center"><Badge>{c.reviewType}</Badge></TableCell>
                      <TableCell className="text-center">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{c.productName}</TableCell>
                      <TableCell>{c.productOption || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{Number(c.productPrice).toLocaleString()}원</TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="link" size="sm" className="h-auto p-0">
                          <a href={toAbsoluteUrl(c.productUrl)} target="_blank" rel="noopener noreferrer">
                            바로가기
                          </a>
                        </Button>
                      </TableCell>
                      <TableCell>{c.keywords}</TableCell>
                      {[...Array(6)].map((_, i) => <TableCell key={i} className="text-muted-foreground">-</TableCell>)}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={17} className="h-48 text-center text-muted-foreground">
                    해당 월에 등록된 캠페인이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}