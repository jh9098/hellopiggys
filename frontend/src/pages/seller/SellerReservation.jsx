// src/pages/seller/SellerReservation.jsx (입금 체크 시 팝업 추가 최종본)

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth, onAuthStateChanged, collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, increment, updateDoc, signOut } from '../../firebaseConfig';
import { nanoid } from 'nanoid';
import { format } from "date-fns";
import { ko } from 'date-fns/locale';
// [추가] 팝업에 사용할 아이콘 임포트
import { Calendar as CalendarIcon, Trash2, CheckCircle } from "lucide-react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

// --- shadcn/ui 컴포넌트 임포트 ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";


// --- 상수 및 헬퍼 함수 ---
const getBasePrice = (deliveryType, reviewType) => {
    if (deliveryType === '실배송') {
        switch (reviewType) {
            case '별점': return 1600; case '텍스트': return 1700; case '포토': return 1800;
            case '프리미엄(포토)': return 4000; case '프리미엄(영상)': return 5000;
            default: return 0;
        }
    } else if (deliveryType === '빈박스') {
        return (reviewType === '별점' || reviewType === '텍스트') ? 5400 : 0;
    }
    return 0;
};

const initialFormState = {
    date: new Date(), deliveryType: '실배송', reviewType: '별점', quantity: 1, productName: '',
    productOption: '', productPrice: 0, productUrl: '', keywords: '', reviewGuide: '', remarks: ''
};

const formatDateForCalendar = (date) => {
    if (!date || !(date instanceof Date)) return '';
    return format(date, "yyyy-MM-dd");
};

const formatDateWithDay = (date) => {
    if (!date || !(date instanceof Date)) return '';
    return format(date, 'yyyy.MM.dd(EEE)', { locale: ko });
};


export default function SellerReservationPage() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const [formState, setFormState] = useState(initialFormState);
    const [campaigns, setCampaigns] = useState([]);
    const [savedCampaigns, setSavedCampaigns] = useState([]);
    const [deposit, setDeposit] = useState(0);
    const [useDeposit, setUseDeposit] = useState(false);
    const [nickname, setNickname] = useState('');
    const [calendarCampaigns, setCalendarCampaigns] = useState([]);
    const [sellersMap, setSellersMap] = useState({});
    const [capacities, setCapacities] = useState({});
    
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [showDepositPopup, setShowDepositPopup] = useState(false);
    
    // [추가] 입금 확인 팝업을 위한 상태
    const [confirmationDialogData, setConfirmationDialogData] = useState(null); // { id, checked } 형태

    const { 
        basePrice, sundayExtraCharge, finalUnitPrice,
        totalSubtotal, totalVat, totalAmount, 
        amountToUseFromDeposit, remainingPayment 
    } = useMemo(() => {
        const basePrice = getBasePrice(formState.deliveryType, formState.reviewType);
        const sundayExtraCharge = formState.date.getDay() === 0 ? 600 : 0;
        const finalUnitPrice = basePrice + sundayExtraCharge;

        let currentTotalSubtotal = 0;
        let currentTotalVat = 0;
        let currentTotalAmount = 0;

        campaigns.forEach(c => {
            currentTotalSubtotal += c.subtotal;
            currentTotalVat += c.vat;
            currentTotalAmount += c.finalTotalAmount;
        });
        
        const currentAmountToUse = useDeposit ? Math.min(currentTotalAmount, deposit) : 0;
        const currentRemainingPayment = currentTotalAmount - currentAmountToUse;

        return {
            basePrice,
            sundayExtraCharge,
            finalUnitPrice,
            totalSubtotal: currentTotalSubtotal,
            totalVat: currentTotalVat,
            totalAmount: currentTotalAmount,
            amountToUseFromDeposit: currentAmountToUse,
            remainingPayment: currentRemainingPayment,
        };
    }, [formState.deliveryType, formState.reviewType, formState.date, campaigns, useDeposit, deposit]);
    
    const calendarEvents = useMemo(() => {
        if (Object.keys(sellersMap).length === 0 || calendarCampaigns.length === 0) return [];
        const dailyAggregates = {};
        calendarCampaigns.filter(c => c.status === '예약 확정').forEach(c => {
            const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
            const dateStr = formatDateForCalendar(d);
            if (!dateStr) return;
            const nick = sellersMap[c.sellerUid] || '판매자';
            const qty = Number(c.quantity) || 0;
            if (!dailyAggregates[dateStr]) dailyAggregates[dateStr] = {};
            if (!dailyAggregates[dateStr][nick]) dailyAggregates[dateStr][nick] = 0;
            dailyAggregates[dateStr][nick] += qty;
        });

        const events = [];
        for (const dateStr in dailyAggregates) {
            for (const nick in dailyAggregates[dateStr]) {
                events.push({ id: `${dateStr}-${nick}`, title: `${nick} (${dailyAggregates[dateStr][nick]}개)`, start: dateStr, allDay: true, extendedProps: { quantity: dailyAggregates[dateStr][nick] } });
            }
        }
        return events;
    }, [calendarCampaigns, sellersMap]);

    useEffect(() => {
        const dateFromQuery = searchParams.get('date');
        if (dateFromQuery) {
            const selectedDate = new Date(dateFromQuery);
            if (!isNaN(selectedDate.getTime())) {
                setFormState(prev => ({ ...prev, date: selectedDate }));
            }
        }
    }, [searchParams]);

    useEffect(() => {
        if (formState.deliveryType === '빈박스' && !['별점', '텍스트'].includes(formState.reviewType)) {
            setFormState(prev => ({ ...prev, reviewType: '별점' }));
        }
    }, [formState.deliveryType, formState.reviewType]);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const listeners = [];
                const q = query(collection(db, "campaigns"), where("sellerUid", "==", currentUser.uid));
                listeners.push(onSnapshot(q, (snapshot) => { setSavedCampaigns(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))); }));
                const sellerDocRef = doc(db, 'sellers', currentUser.uid);
                listeners.push(onSnapshot(sellerDocRef, (doc) => {
                    if (doc.exists()) {
                        const data = doc.data(); setDeposit(data.deposit || 0); setNickname(data.nickname || currentUser.email);
                    }
                }));
                listeners.push(onSnapshot(collection(db, 'sellers'), (snap) => {
                    const map = {}; snap.forEach(d => { const data = d.data(); if (data.uid) map[data.uid] = data.nickname || '이름없음'; });
                    setSellersMap(map);
                }));
                listeners.push(onSnapshot(collection(db, 'campaigns'), (snap) => { setCalendarCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }));
                listeners.push(onSnapshot(collection(db, 'capacities'), (snap) => {
                    const caps = {}; snap.forEach(d => { caps[d.id] = d.data().capacity || 0; });
                    setCapacities(caps);
                }));
                setIsLoading(false);
                return () => listeners.forEach(unsub => unsub());
            } else {
                setUser(null);
                setIsLoading(false);
                navigate('/seller-login');
            }
        });
        return () => unsubscribeAuth();
    }, [navigate]);

    const handleFormChange = (name, value) => {
        setFormState(prev => ({ ...prev, [name]: value }));
    };
    
    const handleDateSelect = (date) => {
        handleFormChange('date', date);
        setIsDatePickerOpen(false);
    };

    const handleAddCampaign = (e) => {
        e.preventDefault();
        
        const reviewFee = finalUnitPrice;
        const productPriceWithAgencyFee = Number(formState.productPrice) * 1.1;
        const subtotalPerItem = reviewFee + productPriceWithAgencyFee;
        const finalAmountPerItem = subtotalPerItem * 1.1;
        const totalSubtotal = subtotalPerItem * Number(formState.quantity);
        const totalFinalAmount = finalAmountPerItem * Number(formState.quantity);
        const totalVat = totalFinalAmount - totalSubtotal;

        const newCampaign = { 
            id: nanoid(), 
            ...formState, 
            reviewFee: reviewFee,
            productPriceWithAgencyFee: productPriceWithAgencyFee,
            subtotal: totalSubtotal,
            vat: totalVat,
            finalTotalAmount: totalFinalAmount
        };

        setCampaigns([...campaigns, newCampaign]);
        setFormState(initialFormState);
    };

    const handleDeleteCampaign = (id) => {
        setCampaigns(campaigns.filter(c => c.id !== id));
    };

    const handleProcessPayment = async () => {
        if (campaigns.length === 0 || !user) {
            alert('결제할 견적 항목이 없습니다.'); return;
        }
        const batch = writeBatch(db);
        const sellerDocRef = doc(db, 'sellers', user.uid);
        
        campaigns.forEach(campaign => {
            const { id, ...campaignData } = campaign;
            const campaignRef = doc(collection(db, 'campaigns'));
            batch.set(campaignRef, {
                ...campaignData,
                sellerUid: user.uid,
                createdAt: serverTimestamp(),
                status: '미확정',
                paymentReceived: false,
                depositConfirmed: false,
            });
        });

        if (useDeposit && amountToUseFromDeposit > 0) {
            batch.update(sellerDocRef, { deposit: increment(-amountToUseFromDeposit) });
        }
        try {
            await batch.commit();
            
            if (remainingPayment > 0) {
                setShowDepositPopup(true);
            } else {
                alert('예치금을 사용하여 예약이 접수되었습니다.');
            }

            setCampaigns([]);
            setUseDeposit(false);
        } catch (error) {
            console.error('결제 처리 중 오류 발생:', error);
            alert('결제 처리 중 오류가 발생했습니다.');
        }
    };
    
    // [수정] 체크박스 클릭 시 팝업을 띄우거나 바로 업데이트하는 핸들러
    const handleDepositCheckboxChange = (id, checked) => {
      if (checked) {
        // 체크하는 경우, 팝업을 띄우기 위해 상태를 설정
        setConfirmationDialogData({ id, checked });
      } else {
        // 체크를 해제하는 경우, 바로 DB 업데이트
        updateDepositStatus(id, checked);
      }
    };

    // [추가] 실제 DB를 업데이트하는 함수
    const updateDepositStatus = async (id, checked) => {
      try {
        await updateDoc(doc(db, 'campaigns', id), { paymentReceived: checked });
      } catch (err) {
        console.error('입금 여부 업데이트 오류:', err);
        alert('입금 상태 변경에 실패했습니다.');
      }
    };
    
    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/seller-login');
        } catch (error) {
            console.error("로그아웃 실패:", error);
            alert("로그아웃에 실패했습니다.");
        }
    };

    const renderDayCell = (info) => {
        const dateStr = formatDateForCalendar(info.date);
        const capacity = capacities[dateStr] || 0;
        const dayEvents = calendarEvents.filter(e => formatDateForCalendar(new Date(e.start)) === dateStr);
        const totalQty = dayEvents.reduce((s, e) => s + Number(e.extendedProps?.quantity || 0), 0);
        const remaining = capacity - totalQty;
        const color = remaining > 0 ? 'text-blue-600' : 'text-red-500';
        return (
            <div className="flex flex-col h-full text-xs">
                <div className="text-right text-gray-500 pr-1 pt-1">{info.dayNumberText}</div>
                <div className="flex-grow flex flex-col items-center justify-center pb-1">
                    <div className="text-[10px] text-gray-500">잔여</div>
                    <span className={`font-bold ${color}`}>{remaining}</span>
                </div>
            </div>
        );
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen"><p>데이터를 불러오는 중입니다...</p></div>;

    return (
        <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 p-4 bg-card border rounded-lg shadow-sm">
                <div className="flex items-center space-x-4">
                    <div className="text-sm font-semibold">
                        <span className="text-muted-foreground">보유 예치금:</span>
                        <span className="ml-2 text-lg text-primary">{deposit.toLocaleString()}원</span>
                    </div>
                    <div className="flex items-center space-x-2 border-l pl-4">
                        <input 
                            type="checkbox" 
                            id="use-deposit-global" 
                            checked={useDeposit} 
                            onChange={(e) => setUseDeposit(e.target.checked)} 
                            disabled={deposit === 0 || totalAmount === 0} 
                            className="h-4 w-4 accent-primary"
                        />
                        <Label htmlFor="use-deposit-global" className="text-sm font-medium">
                            견적 결제 시 예치금 사용
                        </Label>
                    </div>
                </div>
                <Button onClick={handleLogout} variant="outline" size="sm">
                    로그아웃
                </Button>
            </div>

            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>새 작업 추가</CardTitle>
                        <CardDescription>진행할 리뷰 캠페인의 정보를 입력하고 견적에 추가하세요.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleAddCampaign}>
                        <CardContent className="grid lg:grid-cols-3 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <Label htmlFor="date">진행 일자</Label>
                                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                id="date"
                                                variant={"outline"}
                                                className={cn( "w-full justify-start text-left font-normal", !formState.date && "text-muted-foreground" )}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formState.date ? format(formState.date, "PPP", {locale: ko}) : <span>날짜 선택</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={formState.date} onSelect={handleDateSelect} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div className="text-xs">
                                    <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" headerToolbar={{ left: 'prev', center: 'title', right: 'next' }} events={calendarEvents} dayCellContent={renderDayCell} dayCellClassNames="h-16" locale="ko" height="auto" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div><Label htmlFor="deliveryType">구분</Label><Select name="deliveryType" value={formState.deliveryType} onValueChange={(v) => handleFormChange('deliveryType', v)}><SelectTrigger id="deliveryType"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="실배송">실배송</SelectItem><SelectItem value="빈박스">빈박스</SelectItem></SelectContent></Select></div>
                                    <div><Label htmlFor="reviewType">리뷰 종류</Label><Select name="reviewType" value={formState.reviewType} onValueChange={(v) => handleFormChange('reviewType', v)}><SelectTrigger id="reviewType"><SelectValue/></SelectTrigger><SelectContent>{formState.deliveryType === '실배송' ? (<><SelectItem value="별점">별점</SelectItem><SelectItem value="텍스트">텍스트</SelectItem><SelectItem value="포토">포토</SelectItem><SelectItem value="프리미엄(포토)">프리미엄(포토)</SelectItem><SelectItem value="프리미엄(영상)">프리미엄(영상)</SelectItem></>) : (<><SelectItem value="별점">별점</SelectItem><SelectItem value="텍스트">텍스트</SelectItem></>)}</SelectContent></Select></div>
                                    <div><Label htmlFor="quantity">체험단 개수</Label><Input id="quantity" type="number" name="quantity" value={formState.quantity} onChange={(e) => handleFormChange(e.target.name, e.target.value)} min="1" required /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label htmlFor="productName">상품명</Label><Input id="productName" name="productName" value={formState.productName} onChange={(e) => handleFormChange(e.target.name, e.target.value)} required /></div>
                                    <div><Label htmlFor="productPrice">상품가</Label><Input id="productPrice" type="number" name="productPrice" value={formState.productPrice} onChange={(e) => handleFormChange(e.target.name, e.target.value)} placeholder="0" /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label htmlFor="productOption">옵션</Label><Input id="productOption" name="productOption" value={formState.productOption} onChange={(e) => handleFormChange(e.target.name, e.target.value)} /></div>
                                    <div><Label htmlFor="keywords">키워드 (1개)</Label><Input id="keywords" name="keywords" value={formState.keywords} onChange={(e) => handleFormChange(e.target.name, e.target.value)} /></div>
                                </div>
                                <div>
                                    <Label htmlFor="productUrl">상품 URL</Label><Input id="productUrl" type="url" name="productUrl" value={formState.productUrl} onChange={(e) => handleFormChange(e.target.name, e.target.value)} placeholder="https://..." />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="reviewGuide">리뷰 가이드</Label>
                                <Textarea id="reviewGuide" name="reviewGuide" value={formState.reviewGuide} onChange={(e) => handleFormChange(e.target.name, e.target.value)} disabled={formState.reviewType === '별점'} className="h-48" />
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center flex-wrap gap-4">
                            <div className="flex items-center space-x-2 text-sm">
                                <span>단가: {basePrice.toLocaleString()}원</span>
                                {sundayExtraCharge > 0 && <span className="text-destructive">+ 공휴일 {sundayExtraCharge.toLocaleString()}원</span>}
                                <span className="font-semibold">= 체험단 진행비 {finalUnitPrice.toLocaleString()}원</span>
                                <PriceListDialog />
                            </div>
                            <Button type="submit">견적에 추가</Button>
                        </CardFooter>
                    </form>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>견적 목록(스프레드시트)</CardTitle>
                        <CardDescription>
                            결제를 진행할 캠페인 목록입니다.<br/>
                            - 품절 등으로 진행 불가 시 상품가만 예치금으로 전환됩니다.<br/>
                            - 대표님 귀책 사유로 세금계산서 변경 시 수수료 10,000원 부과됩니다.<br/>
                            - 견적 상세 = [체험단 진행비 + 상품가 × (1 + 대행수수료 10%)] × (1 + 부가세 10%) × 수량
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>{['일자', '구분', '리뷰', '수량', '상품명', '상품가', '견적상세', '최종금액', '삭제'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                                </TableHeader>
                                <TableBody>
                                    {campaigns.length === 0 ? (
                                        <TableRow><TableCell colSpan="9" className="h-24 text-center text-muted-foreground">위에서 작업을 추가해주세요.</TableCell></TableRow>
                                    ) : (
                                        campaigns.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className={c.date.getDay() === 0 ? 'text-destructive font-semibold' : ''}>{formatDateWithDay(c.date)}</TableCell>
                                                <TableCell><Badge variant="outline">{c.deliveryType}</Badge></TableCell>
                                                <TableCell><Badge>{c.reviewType}</Badge></TableCell>
                                                <TableCell>{c.quantity}</TableCell>
                                                <TableCell className="font-medium">{c.productName}</TableCell>
                                                <TableCell className="text-right">{Number(c.productPrice).toLocaleString()}원</TableCell>
                                                <TableCell className="text-xs text-muted-foreground font-mono">
                                                    {`( ${c.reviewFee.toLocaleString()} + ${Number(c.productPrice).toLocaleString()} × 1.1 ) × ${c.quantity} × 1.1`}
                                                </TableCell>
                                                <TableCell className="font-semibold text-right">{Math.round(c.finalTotalAmount).toLocaleString()}원</TableCell>
                                                <TableCell><Button variant="ghost" size="icon" onClick={() => handleDeleteCampaign(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    {campaigns.length > 0 && (
                        <CardFooter className="flex flex-col items-end gap-2 text-right">
                            <div className="text-sm text-muted-foreground">공급가액 합계: {totalSubtotal.toLocaleString()}원</div>
                            <div className="text-sm text-muted-foreground">부가세 (10%): {totalVat.toLocaleString()}원</div>
                            <div className="font-semibold">총 결제 금액: {totalAmount.toLocaleString()}원</div>
                            
                            {useDeposit && (
                                <>
                                    <Separator className="my-2"/>
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">예치금 사용: </span>
                                        <span className="font-semibold text-destructive">- {amountToUseFromDeposit.toLocaleString()}원</span>
                                    </div>
                                </>
                            )}
                            
                            <Separator className="my-2"/>
                            <div className="text-xl font-bold">최종 결제 금액: <span className="text-primary">{remainingPayment.toLocaleString()}</span>원</div>
                            <p className="mt-2 text-sm font-bold text-green-600">※ 총 결제금 전액 비용처리 가능 (세금계산서 발행)</p>
                            <Button onClick={handleProcessPayment} size="lg" className="mt-4">
                                {remainingPayment > 0 ? `${remainingPayment.toLocaleString()}원 입금하기` : `예치금으로 결제`}
                            </Button>
                        </CardFooter>
                    )}
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>나의 예약 내역</CardTitle>
                        <CardDescription>과거에 예약한 모든 캠페인 내역입니다. 입금 완료 후 '입금'란을 체크해주세요.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>{['일자', '상품명', '구분', '리뷰', '수량', '입금', '상태', '최종금액'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedCampaigns.length === 0 ? (
                                         <TableRow><TableCell colSpan="8" className="h-24 text-center text-muted-foreground">예약 내역이 없습니다.</TableCell></TableRow>
                                    ) : (
                                        savedCampaigns.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell>{c.date?.seconds ? formatDateWithDay(new Date(c.date.seconds * 1000)) : '-'}</TableCell>
                                                <TableCell className="font-medium">{c.productName}</TableCell>
                                                <TableCell><Badge variant="outline">{c.deliveryType}</Badge></TableCell>
                                                <TableCell><Badge>{c.reviewType}</Badge></TableCell>
                                                <TableCell>{c.quantity}</TableCell>
                                                {/* [수정] 체크박스 핸들러 변경 */}
                                                <TableCell>
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!c.paymentReceived} 
                                                        onChange={(e) => handleDepositCheckboxChange(c.id, e.target.checked)} 
                                                        title="입금 완료 시 체크"
                                                    />
                                                </TableCell>
                                                <TableCell><Badge variant={c.status === '예약 확정' ? 'default' : 'secondary'}>{c.status}</Badge></TableCell>
                                                <TableCell className="text-right">{Math.round(c.finalTotalAmount || 0).toLocaleString()}원</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                <Dialog open={showDepositPopup} onOpenChange={setShowDepositPopup}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="text-2xl text-center font-bold">입금 계좌 안내</DialogTitle>
                            <DialogDescription className="text-center pt-2">
                                아래 계좌로 <strong className="text-primary">{remainingPayment.toLocaleString()}원</strong>을 입금해주세요.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="my-6 p-6 bg-muted rounded-lg space-y-4 text-base sm:text-lg">
                            <div className="flex items-center">
                                <span className="w-28 font-semibold text-muted-foreground">은 행</span>
                                <span>국민은행</span>
                            </div>
                            <div className="flex items-center">
                                <span className="w-28 font-semibold text-muted-foreground">계좌번호</span>
                                <span className="font-mono tracking-wider">289537-00-006049</span>
                            </div>
                            <div className="flex items-center">
                                <span className="w-28 font-semibold text-muted-foreground">예금주</span>
                                <span>아이언마운틴컴퍼니</span>
                            </div>
                        </div>
                        
                        <Button 
                            onClick={() => setShowDepositPopup(false)} 
                            className="w-full h-12 text-lg mt-2"
                        >
                            확인
                        </Button>
                    </DialogContent>
                </Dialog>

                {/* [추가] 입금 확인 정보 팝업 */}
                <Dialog open={!!confirmationDialogData} onOpenChange={() => setConfirmationDialogData(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center space-x-2">
                                <CheckCircle className="text-green-500" />
                                <span>입금 확인 요청</span>
                            </DialogTitle>
                            <DialogDescription className="pt-4 text-base">
                                입금 확인을 요청했습니다. <br/>
                                관리자 승인 후 예약이 자동으로 확정됩니다.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="mt-4">
                            <Button
                                className="w-full"
                                onClick={() => {
                                    if (confirmationDialogData) {
                                        updateDepositStatus(confirmationDialogData.id, confirmationDialogData.checked);
                                    }
                                    setConfirmationDialogData(null);
                                }}
                            >
                                확인
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}

function PriceListDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs h-auto p-1">단가표 보기</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>리뷰 캠페인 단가표</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">📦 실배송</h4>
                        <Table>
                            <TableHeader><TableRow><TableHead>리뷰 종류</TableHead><TableHead className="text-right">단가</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow><TableCell>별점</TableCell><TableCell className="text-right">1,600원</TableCell></TableRow>
                                <TableRow><TableCell>텍스트</TableCell><TableCell className="text-right">1,700원</TableCell></TableRow>
                                <TableRow><TableCell>포토</TableCell><TableCell className="text-right">1,800원</TableCell></TableRow>
                                <TableRow><TableCell>프리미엄(포토)</TableCell><TableCell className="text-right">4,000원</TableCell></TableRow>
                                <TableRow><TableCell>프리미엄(영상)</TableCell><TableCell className="text-right">5,000원</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2">👻 빈박스</h4>
                        <Table>
                            <TableHeader><TableRow><TableHead>리뷰 종류</TableHead><TableHead className="text-right">단가</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow><TableCell>별점</TableCell><TableCell className="text-right">5,400원</TableCell></TableRow>
                                <TableRow><TableCell>텍스트</TableCell><TableCell className="text-right">5,400원</TableCell></TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </div>
                 <DialogFooter className="mt-4">
                    <p className="text-xs text-muted-foreground">* 일요일/공휴일 진행 시 <strong className="text-destructive">600원</strong>의 가산금이 추가됩니다.</p>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}