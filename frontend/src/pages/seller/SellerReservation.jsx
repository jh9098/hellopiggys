// src/pages/seller/SellerReservation.jsx (요청사항 반영 최종 수정본)

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, auth, onAuthStateChanged, collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, increment, updateDoc, signOut, deleteDoc } from '../../firebaseConfig';
import { nanoid } from 'nanoid';
import { format } from "date-fns";
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Trash2, CheckCircle, Search, AlertTriangle } from "lucide-react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

import axios from 'axios';
import hmacSHA256 from 'crypto-js/hmac-sha256';

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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox"; // [추가] Checkbox 임포트
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


function CoupangSearchResults({ results, isLoading, error }) {
    if (isLoading) return <div className="p-4 text-center text-muted-foreground">검색 중입니다...</div>;
    if (error) return <div className="p-4 text-center text-destructive">{error}</div>;
    if (results.length === 0) return <div className="p-4 text-center text-muted-foreground">검색 결과가 없습니다.</div>;
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 max-h-96 overflow-y-auto p-1">
            {results.map((item, index) => (
                <a key={index} href={item.productUrl} target="_blank" rel="noopener noreferrer" className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                    <img src={item.productImage} alt={item.productName} className="w-full h-40 object-cover" />
                    <div className="p-3">
                        <p className="text-sm font-medium truncate">{item.productName}</p>
                        <p className="text-lg font-bold text-primary mt-1">{item.productPrice.toLocaleString()}원</p>
                    </div>
                </a>
            ))}
        </div>
    );
}

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
    const [confirmationDialogData, setConfirmationDialogData] = useState(null);
    const [pendingCampaign, setPendingCampaign] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState('');
    
    // [추가] 상태 변수
    const [isVatApplied, setIsVatApplied] = useState(true);
    const [selectedSavedCampaigns, setSelectedSavedCampaigns] = useState([]);
    const [deleteConfirmation, setDeleteConfirmation] = useState(null); // 삭제 확인용: { type: 'single' | 'multiple', ids: string[] }

    // [수정] 가격 계산 useMemo
    const { 
        basePrice, sundayExtraCharge, finalUnitPrice,
        totalSubtotal, totalVat, totalAmount, 
        amountToUseFromDeposit, remainingPayment 
    } = useMemo(() => {
        const basePrice = getBasePrice(formState.deliveryType, formState.reviewType);
        const sundayExtraCharge = formState.date.getDay() === 0 ? 600 : 0;
        const finalUnitPrice = basePrice + sundayExtraCharge;

        const updatedCampaigns = campaigns.map(c => {
            const reviewFee = getBasePrice(c.deliveryType, c.reviewType) + (c.date.getDay() === 0 ? 600 : 0);
            const productPriceWithAgencyFee = Number(c.productPrice) * 1.1;
            const subtotalPerItem = reviewFee + productPriceWithAgencyFee;
            const totalSubtotal = subtotalPerItem * Number(c.quantity);
            
            const finalTotalAmount = isVatApplied ? totalSubtotal * 1.1 : totalSubtotal;

            return {
                ...c,
                reviewFee,
                subtotal: totalSubtotal,
                vat: finalTotalAmount - totalSubtotal,
                finalTotalAmount: finalTotalAmount
            };
        });

        const currentTotalSubtotal = updatedCampaigns.reduce((sum, c) => sum + c.subtotal, 0);
        const currentTotalAmount = updatedCampaigns.reduce((sum, c) => sum + c.finalTotalAmount, 0);
        const currentTotalVat = currentTotalAmount - currentTotalSubtotal;

        const currentAmountToUse = useDeposit ? Math.min(currentTotalAmount, deposit) : 0;
        const currentRemainingPayment = Math.ceil(currentTotalAmount - currentAmountToUse); // [수정] 소수점 올림

        return {
            basePrice,
            sundayExtraCharge,
            finalUnitPrice,
            totalSubtotal: Math.round(currentTotalSubtotal),
            totalVat: Math.round(currentTotalVat),
            totalAmount: Math.round(currentTotalAmount),
            amountToUseFromDeposit: Math.round(currentAmountToUse),
            remainingPayment: currentRemainingPayment,
        };
    }, [formState, campaigns, useDeposit, deposit, isVatApplied]);
    
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

    const handleFormChange = (name, value) => setFormState(prev => ({ ...prev, [name]: value }));
    const handleDateSelect = (date) => {
        handleFormChange('date', date);
        setIsDatePickerOpen(false);
    };
    const handleAddCampaign = (e) => {
        e.preventDefault();
        const newCampaign = { 
            id: nanoid(), 
            ...formState, 
        };

        if (!formState.productOption.trim()) {
            setPendingCampaign(newCampaign);
        } else {
            setCampaigns(prev => [...prev, newCampaign]);
            setFormState(initialFormState);
        }
    };
    const handleConfirmAddCampaign = () => {
        if (pendingCampaign) {
            setCampaigns(prev => [...prev, pendingCampaign]);
            setFormState(initialFormState);
            setPendingCampaign(null); 
        }
    };
    const handleDeleteCampaign = (id) => setCampaigns(campaigns.filter(c => c.id !== id));
    
    // [수정] 입금하기 버튼 핸들러
    const handleProcessPayment = async () => {
        if (campaigns.length === 0 || !user) {
            alert('견적에 추가된 캠페인이 없습니다.');
            return;
        }

        const batch = writeBatch(db);
        const sellerDocRef = doc(db, 'sellers', user.uid);
        
        // useMemo에서 계산된 최신 값들을 참조하여 각 캠페인 저장
        const updatedCampaigns = campaigns.map(c => {
             const reviewFee = getBasePrice(c.deliveryType, c.reviewType) + (c.date.getDay() === 0 ? 600 : 0);
             const productPriceWithAgencyFee = Number(c.productPrice) * 1.1;
             const subtotalPerItem = reviewFee + productPriceWithAgencyFee;
             const totalSubtotal = subtotalPerItem * Number(c.quantity);
             const finalTotalAmount = isVatApplied ? totalSubtotal * 1.1 : totalSubtotal;
 
             return {
                 ...c,
                 reviewFee,
                 productPriceWithAgencyFee: productPriceWithAgencyFee,
                 subtotal: totalSubtotal,
                 vat: finalTotalAmount - totalSubtotal,
                 finalTotalAmount: finalTotalAmount,
             };
        });

        updatedCampaigns.forEach(campaign => {
            const campaignRef = doc(collection(db, 'campaigns'));
            const { id, ...campaignData } = campaign; // 임시 id는 제거
            batch.set(campaignRef, {
                ...campaignData,
                sellerUid: user.uid,
                createdAt: serverTimestamp(),
                status: '예약 대기', // 초기 상태
                paymentReceived: remainingPayment <= 0,
                isVatApplied,
            });
        });

        if (useDeposit && amountToUseFromDeposit > 0) {
            batch.update(sellerDocRef, { deposit: increment(-amountToUseFromDeposit) });
        }

        try {
            await batch.commit();
            setCampaigns([]); // 견적 목록 비우기
            if (remainingPayment > 0) {
                setShowDepositPopup(true);
            } else {
                alert('예치금으로 결제가 완료되어 예약이 접수되었습니다.');
            }
        } catch (error) {
            console.error("결제 처리 중 오류 발생: ", error);
            alert('오류가 발생하여 결제를 완료하지 못했습니다.');
        }
    };

    const handleDepositCheckboxChange = (id, checked) => {
      if (checked) { setConfirmationDialogData({ id, checked }); } else { updateDepositStatus(id, checked); }
    };
    const updateDepositStatus = async (id, checked) => {
      try { await updateDoc(doc(db, 'campaigns', id), { paymentReceived: checked }); } catch (err) { console.error('입금 여부 업데이트 오류:', err); }
    };
    const handleLogout = async () => {
        try { await signOut(auth); navigate('/seller-login'); } catch (error) { console.error("로그아웃 실패:", error); }
    };
    const handleKeywordSearch = async () => { /* 기존과 동일 */ };
    const renderDayCell = (info) => { /* 기존과 동일 */ };

    // [추가] 예약 내역 삭제 관련 핸들러
    const handleDeleteSavedCampaigns = async () => {
        if (!deleteConfirmation || !deleteConfirmation.ids || deleteConfirmation.ids.length === 0) return;
        
        const idsToDelete = deleteConfirmation.ids;
        const batch = writeBatch(db);
        idsToDelete.forEach(id => {
            const docRef = doc(db, 'campaigns', id);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            // 삭제 성공 후 선택 상태 초기화
            setSelectedSavedCampaigns(prev => prev.filter(id => !idsToDelete.includes(id)));
            setDeleteConfirmation(null);
        } catch (error) {
            console.error("캠페인 삭제 중 오류 발생:", error);
            alert("삭제 중 오류가 발생했습니다.");
        }
    };

    const handleSelectSavedCampaign = (id, checked) => {
        setSelectedSavedCampaigns(prev => 
            checked ? [...prev, id] : prev.filter(item => item !== id)
        );
    };

    const handleSelectAllSavedCampaigns = (checked) => {
        setSelectedSavedCampaigns(checked ? savedCampaigns.map(c => c.id) : []);
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
                        <input type="checkbox" id="use-deposit-global" checked={useDeposit} onChange={(e) => setUseDeposit(e.target.checked)} disabled={deposit === 0 || totalAmount === 0} className="h-4 w-4 accent-primary" />
                        <Label htmlFor="use-deposit-global" className="text-sm font-medium">견적 결제 시 예치금 사용</Label>
                    </div>
                </div>
                <Button onClick={handleLogout} variant="outline" size="sm">로그아웃</Button>
            </div>

            <div className="space-y-8">
                <Card>
                    {/* ... 새 작업 추가 폼은 기존과 동일 ... */}
                    <CardHeader>
                        <CardTitle>새 작업 추가</CardTitle>
                        <CardDescription>진행할 리뷰 캠페인의 정보를 입력하고 견적에 추가하세요.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleAddCampaign}>
                        <CardContent className="grid lg:grid-cols-3 gap-8">{/* ... */}</CardContent>
                        <CardFooter className="flex justify-between items-center flex-wrap gap-4">{/* ... */}</CardFooter>
                    </form>
                </Card>

                <Card>
                    <CardHeader><CardTitle>견적 목록(스프레드시트)</CardTitle><CardDescription>결제를 진행할 캠페인 목록입니다.<br/>- 품절 등으로 진행 불가 시 상품가만 예치금으로 전환됩니다.<br/>- 대표님 귀책 사유로 세금계산서 변경 시 수수료 10,000원 부과됩니다.<br/>- 견적 상세 = [체험단 진행비 + 상품가 × (1 + 대행수수료 10%)] × 수량 {isVatApplied && "× (1 + 부가세 10%)"}</CardDescription></CardHeader>
                    <CardContent><div className="border rounded-md"><Table><TableHeader><TableRow>{['일자', '구분', '리뷰', '수량', '상품명', '상품가', '견적상세', '최종금액', '삭제'].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{campaigns.length === 0 ? (<TableRow><TableCell colSpan="9" className="h-24 text-center text-muted-foreground">위에서 작업을 추가해주세요.</TableCell></TableRow>) : (campaigns.map((c) => {
                        const reviewFee = getBasePrice(c.deliveryType, c.reviewType) + (c.date.getDay() === 0 ? 600 : 0);
                        const subtotal = (reviewFee + Number(c.productPrice) * 1.1) * Number(c.quantity);
                        const finalAmount = isVatApplied ? subtotal * 1.1 : subtotal;
                        
                        return (<TableRow key={c.id}><TableCell className={c.date.getDay() === 0 ? 'text-destructive font-semibold' : ''}>{formatDateWithDay(c.date)}</TableCell><TableCell><Badge variant="outline">{c.deliveryType}</Badge></TableCell><TableCell><Badge>{c.reviewType}</Badge></TableCell><TableCell>{c.quantity}</TableCell><TableCell className="font-medium">{c.productName}</TableCell><TableCell className="text-right">{Number(c.productPrice).toLocaleString()}원</TableCell><TableCell className="text-xs text-muted-foreground font-mono">{`( ${reviewFee.toLocaleString()} + ${Number(c.productPrice).toLocaleString()} × 1.1 ) × ${c.quantity} ${isVatApplied ? '× 1.1' : ''}`}</TableCell><TableCell className="font-semibold text-right">{Math.round(finalAmount).toLocaleString()}원</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => handleDeleteCampaign(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell></TableRow>);
                    }))}</TableBody></Table></div></CardContent>
                    {campaigns.length > 0 && (<CardFooter className="flex flex-col items-end gap-2 text-right">
                        <div className="text-sm text-muted-foreground">공급가액 합계: {totalSubtotal.toLocaleString()}원</div>
                        <div className="text-sm text-muted-foreground">부가세 (10%): {totalVat.toLocaleString()}원</div>
                        <div className="font-semibold">총 결제 금액: {totalAmount.toLocaleString()}원</div>
                        {useDeposit && (<><Separator className="my-2"/><div className="text-sm"><span className="text-muted-foreground">예치금 사용: </span><span className="font-semibold text-destructive">- {amountToUseFromDeposit.toLocaleString()}원</span></div></>)}
                        <Separator className="my-2"/>
                        <div className="text-xl font-bold">최종 결제 금액: <span className="text-primary">{remainingPayment.toLocaleString()}</span>원</div>
                        {/* [수정] 부가세 체크박스 추가 */}
                        <div className="flex items-center space-x-2 mt-2">
                            <Checkbox id="vat-checkbox" checked={isVatApplied} onCheckedChange={setIsVatApplied} />
                            <label htmlFor="vat-checkbox" className="text-sm font-bold text-green-600 cursor-pointer">
                                ※ 총 결제금 전액 비용처리 가능 (세금계산서 발행)
                            </label>
                        </div>
                        <Button onClick={handleProcessPayment} size="lg" className="mt-4">{remainingPayment > 0 ? `${remainingPayment.toLocaleString()}원 입금하기` : `예치금으로 결제`}</Button>
                    </CardFooter>)}
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>나의 예약 내역</CardTitle>
                            <CardDescription>과거에 예약한 모든 캠페인 내역입니다. 입금 완료 후 '입금'란을 체크해주세요.</CardDescription>
                        </div>
                        {/* [추가] 선택항목 삭제 버튼 */}
                        <Button variant="destructive" onClick={() => setDeleteConfirmation({ type: 'multiple', ids: selectedSavedCampaigns })} disabled={selectedSavedCampaigns.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            선택 항목 삭제 ({selectedSavedCampaigns.length})
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox 
                                                onCheckedChange={handleSelectAllSavedCampaigns}
                                                checked={savedCampaigns.length > 0 && selectedSavedCampaigns.length === savedCampaigns.length}
                                                aria-label="모두 선택"
                                            />
                                        </TableHead>
                                        {['일자', '상품명', '구분', '리뷰', '수량', '입금', '상태', '최종금액', '관리'].map(h => <TableHead key={h}>{h}</TableHead>)}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedCampaigns.length === 0 ? (
                                        <TableRow><TableCell colSpan="10" className="h-24 text-center text-muted-foreground">예약 내역이 없습니다.</TableCell></TableRow>
                                    ) : (
                                        savedCampaigns.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedSavedCampaigns.includes(c.id)}
                                                        onCheckedChange={(checked) => handleSelectSavedCampaign(c.id, checked)}
                                                        aria-label={`${c.productName} 선택`}
                                                    />
                                                </TableCell>
                                                <TableCell>{c.date?.seconds ? formatDateWithDay(new Date(c.date.seconds * 1000)) : '-'}</TableCell>
                                                <TableCell className="font-medium">{c.productName}</TableCell>
                                                <TableCell><Badge variant="outline">{c.deliveryType}</Badge></TableCell>
                                                <TableCell><Badge>{c.reviewType}</Badge></TableCell>
                                                <TableCell>{c.quantity}</TableCell>
                                                <TableCell><input type="checkbox" checked={!!c.paymentReceived} onChange={(e) => handleDepositCheckboxChange(c.id, e.target.checked)} title="입금 완료 시 체크"/></TableCell>
                                                <TableCell><Badge variant={c.status === '예약 확정' ? 'default' : c.status === '예약 대기' ? 'secondary' : 'destructive'}>{c.status}</Badge></TableCell>
                                                <TableCell className="text-right">{Math.round(c.finalTotalAmount || 0).toLocaleString()}원</TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmation({ type: 'single', ids: [c.id] })}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
                
                {/* ... 기존 Dialog 컴포넌트들 ... */}
                <Dialog open={showDepositPopup} onOpenChange={setShowDepositPopup}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="text-2xl text-center font-bold">입금 계좌 안내</DialogTitle><DialogDescription className="text-center pt-2">예약이 접수되었습니다. 아래 계좌로 <strong className="text-primary">{remainingPayment.toLocaleString()}원</strong>을 입금해주세요.</DialogDescription></DialogHeader><div className="my-6 p-6 bg-muted rounded-lg space-y-4 text-base sm:text-lg"><div className="flex items-center"><span className="w-28 font-semibold text-muted-foreground">은 행</span><span>국민은행</span></div><div className="flex items-center"><span className="w-28 font-semibold text-muted-foreground">계좌번호</span><span className="font-mono tracking-wider">289537-00-006049</span></div><div className="flex items-center"><span className="w-28 font-semibold text-muted-foreground">예금주</span><span>아이언마운틴컴퍼니</span></div></div><Button onClick={() => setShowDepositPopup(false)} className="w-full h-12 text-lg mt-2">확인</Button></DialogContent></Dialog>
                <Dialog open={!!confirmationDialogData} onOpenChange={() => setConfirmationDialogData(null)}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center space-x-2"><CheckCircle className="text-green-500" /><span>입금 확인 요청</span></DialogTitle><DialogDescription className="pt-4 text-base">입금 확인을 요청했습니다. <br/>관리자 승인 후 예약이 자동으로 확정됩니다.</DialogDescription></DialogHeader><DialogFooter className="mt-4"><Button className="w-full" onClick={() => { if (confirmationDialogData) { updateDepositStatus(confirmationDialogData.id, confirmationDialogData.checked); } setConfirmationDialogData(null); }}>확인</Button></DialogFooter></DialogContent></Dialog>
                <AlertDialog open={!!pendingCampaign} onOpenChange={() => setPendingCampaign(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>옵션 미입력 확인</AlertDialogTitle><AlertDialogDescription>옵션이 입력되지 않았습니다. 이대로 견적에 추가하시겠습니까?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleConfirmAddCampaign}>추가</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                
                {/* [추가] 삭제 확인 AlertDialog */}
                <AlertDialog open={!!deleteConfirmation} onOpenChange={() => setDeleteConfirmation(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center">
                                <AlertTriangle className="mr-2 text-destructive"/>
                                예약 내역 삭제 확인
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                {deleteConfirmation?.type === 'multiple'
                                    ? `선택된 ${deleteConfirmation.ids.length}개의 캠페인 예약을 정말로 삭제하시겠습니까?`
                                    : '이 캠페인 예약을 정말로 삭제하시겠습니까?'}
                                <br/>이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteSavedCampaigns} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                삭제
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </>
    );
}

function PriceListDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild><Button variant="ghost" size="sm" className="text-xs h-auto p-1">단가표 보기</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>리뷰 캠페인 단가표</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    <div><h4 className="font-semibold mb-2">📦 실배송</h4><Table><TableHeader><TableRow><TableHead>리뷰 종류</TableHead><TableHead className="text-right">단가</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>별점</TableCell><TableCell className="text-right">1,600원</TableCell></TableRow><TableRow><TableCell>텍스트</TableCell><TableCell className="text-right">1,700원</TableCell></TableRow><TableRow><TableCell>포토</TableCell><TableCell className="text-right">1,800원</TableCell></TableRow><TableRow><TableCell>프리미엄(포토)</TableCell><TableCell className="text-right">4,000원</TableCell></TableRow><TableRow><TableCell>프리미엄(영상)</TableCell><TableCell className="text-right">5,000원</TableCell></TableRow></TableBody></Table></div>
                    <div><h4 className="font-semibold mb-2">👻 빈박스</h4><Table><TableHeader><TableRow><TableHead>리뷰 종류</TableHead><TableHead className="text-right">단가</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>별점</TableCell><TableCell className="text-right">5,400원</TableCell></TableRow><TableRow><TableCell>텍스트</TableCell><TableCell className="text-right">5,400원</TableCell></TableRow></TableBody></Table></div>
                </div>
                <DialogFooter className="mt-4"><p className="text-xs text-muted-foreground">* 일요일/공휴일 진행 시 <strong className="text-destructive">600원</strong>의 가산금이 추가됩니다.</p></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}