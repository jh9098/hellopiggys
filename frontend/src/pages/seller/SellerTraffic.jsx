// src/pages/seller/SellerTraffic.jsx (shadcn/ui 리팩토링 버전)

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, onAuthStateChanged, collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, increment, updateDoc, getDoc } from '../../firebaseConfig';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Info } from "lucide-react";

// --- shadcn/ui 컴포넌트 임포트 ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const formatDateWithDay = (date) => {
    if (!date || !(date instanceof Date)) return '-';
    return format(date, 'yyyy-MM-dd (EEE)', { locale: ko });
};

export default function SellerTrafficPage() {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [savedRequests, setSavedRequests] = useState([]);
    const [deposit, setDeposit] = useState(0);
    const [useDeposit, setUseDeposit] = useState(false);
    const [showDepositPopup, setShowDepositPopup] = useState(false);
    const [confirmRequest, setConfirmRequest] = useState(null);

    useEffect(() => {
        const fetchProducts = async () => {
            const snap = await getDoc(doc(db, 'config', 'traffic_products'));
            if (snap.exists()) {
                const data = snap.data().products || [];
                setProducts(data.map(p => ({
                    ...p,
                    salePrice: Math.round(p.retailPrice * (1 - p.discountRate)),
                    quantity: 0,
                    requestDate: null,
                })));
            }
        };
        fetchProducts();
    }, []);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const q = query(collection(db, "traffic_requests"), where("sellerUid", "==", currentUser.uid));
                const unsubscribeRequests = onSnapshot(q, (snapshot) => {
                    setSavedRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
                });
                const sellerDocRef = doc(db, 'sellers', currentUser.uid);
                const unsubscribeSeller = onSnapshot(sellerDocRef, (doc) => {
                    if (doc.exists()) setDeposit(doc.data().deposit || 0);
                });
                setIsLoading(false);
                return () => { unsubscribeRequests(); unsubscribeSeller(); };
            } else {
                setUser(null);
                setIsLoading(false);
                navigate('/seller-login');
            }
        });
        return () => unsubscribeAuth();
    }, [navigate]);

    const handleInputChange = (index, field, value) => {
        const newProducts = [...products];
        newProducts[index][field] = field === 'quantity' ? Math.max(0, Number(value)) : value;
        setProducts(newProducts);
    };

    const categoryRowSpans = useMemo(() => {
        const spans = {};
        if (products.length === 0) return spans;
        let i = 0;
        while (i < products.length) {
            let j = i + 1;
            while (j < products.length && products[j].category === products[i].category) {
                j++;
            }
            spans[i] = j - i;
            for (let k = i + 1; k < j; k++) spans[k] = 0;
            i = j;
        }
        return spans;
    }, [products]);

    const handleProcessPayment = async () => {
        const itemsToRequest = products.filter(p => p.quantity > 0 && p.requestDate);
        if (itemsToRequest.length === 0 || !user) {
            alert('요청할 상품의 수량과 요청일자를 모두 입력해주세요.');
            return;
        }
        const batch = writeBatch(db);
        const sellerDocRef = doc(db, 'sellers', user.uid);

        itemsToRequest.forEach(item => {
            const { retailPrice, discountRate, ...requestData } = item;
            const requestRef = doc(collection(db, 'traffic_requests'));
            const itemTotal = item.salePrice * item.quantity;
            const finalItemAmount = Math.round(itemTotal * 1.1);
            batch.set(requestRef, {
                ...requestData,
                sellerUid: user.uid,
                createdAt: serverTimestamp(),
                status: '미확정',
                paymentReceived: false,
                depositConfirmed: false,
                itemTotal,
                finalItemAmount,
            });
        });

        if (useDeposit && amountToUseFromDeposit > 0) {
            batch.update(sellerDocRef, { deposit: increment(-amountToUseFromDeposit) });
        }
        try {
            await batch.commit();
            setShowDepositPopup(true);
        } catch (error) {
            console.error('결제 처리 중 오류 발생:', error);
            alert('결제 처리 중 오류가 발생했습니다.');
        }
    };
    
    const handleClosePopupAndReset = () => {
        setShowDepositPopup(false);
        setProducts(prev => prev.map(p => ({ ...p, quantity: 0, requestDate: null })));
        setUseDeposit(false);
    };

    const handleDepositChange = async (id, checked) => {
        try { await updateDoc(doc(db, 'traffic_requests', id), { paymentReceived: checked }); } 
        catch (err) { console.error('입금 여부 업데이트 오류:', err); }
    };

    const handleConfirmReservation = async () => {
        if (!confirmRequest) return;
        try {
            await updateDoc(doc(db, 'traffic_requests', confirmRequest.id), {
                status: '예약 확정', confirmedAt: serverTimestamp()
            });
        } catch (err) {
            console.error('예약 확정 오류:', err);
        }
        setConfirmRequest(null);
    };

    const quoteTotal = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);
    const totalCommission = Math.round(quoteTotal * 0.1);
    const totalAmount = quoteTotal + totalCommission;
    const amountToUseFromDeposit = useDeposit ? Math.min(totalAmount, deposit) : 0;
    const remainingPayment = totalAmount - amountToUseFromDeposit;

    if (isLoading) return <p>로딩 중...</p>;

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">트래픽 요청서</h1>
            
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>안내사항</AlertTitle>
                <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                        <li>원하는 상품의 구매 개수와 요청일자를 입력하고 '입금하기' 버튼을 눌러주세요.</li>
                        <li>베이직 트래픽 2종은 자가 세팅 / 애드온 트래픽 4종은 정보 전달하여 개발사 대리 세팅</li>
                        <li>트래픽만 사용했을 때 순위 보정 효과가 크지 않을 수 있으므로, 체험단 진행 혹은 오가닉 매출 발생을 병행하는 것이 좋습니다.</li>
                    </ul>
                </AlertDescription>
            </Alert>

            <Card>
                <CardHeader>
                    <CardTitle>트래픽 견적 요청</CardTitle>
                    <CardDescription>상품별 수량과 요청일자를 입력하여 견적을 확인하세요.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[120px]">구분</TableHead>
                                    <TableHead>상품명</TableHead>
                                    <TableHead>설명</TableHead>
                                    <TableHead className="w-[150px]">가격</TableHead>
                                    <TableHead className="w-[100px]">구매개수</TableHead>
                                    <TableHead className="w-[180px]">요청일자</TableHead>
                                    <TableHead className="w-[120px]">시작일자</TableHead>
                                    <TableHead className="w-[120px]">종료일자</TableHead>
                                    <TableHead className="w-[140px] text-right">트래픽 견적</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((p, index) => {
                                    const startDate = p.requestDate ? new Date(p.requestDate.getTime() + 24 * 60 * 60 * 1000) : null;
                                    const endDate = startDate ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                                    const estimate = p.salePrice * p.quantity;
                                    const rowSpan = categoryRowSpans[index];
                                    return (
                                        <TableRow key={index}>
                                            {rowSpan > 0 && <TableCell rowSpan={rowSpan} className="align-top font-semibold bg-muted">{p.category}</TableCell>}
                                            <TableCell className="font-medium">{p.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{p.description.split('\n').map((line, i) => <p key={i}>{line}</p>)}</TableCell>
                                            <TableCell className="text-xs">
                                                <div>시중가: {p.retailPrice.toLocaleString()}원</div>
                                                <div className="text-red-600">할인율: {Math.round(p.discountRate * 100)}%</div>
                                                <div className="font-bold text-blue-600 text-sm">판매가: {p.salePrice.toLocaleString()}원</div>
                                            </TableCell>
                                            <TableCell><Input type="number" value={p.quantity} onChange={(e) => handleInputChange(index, 'quantity', e.target.value)} className="text-center" min="0"/></TableCell>
                                            <TableCell>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !p.requestDate && "text-muted-foreground")}>
                                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                                            {p.requestDate ? format(p.requestDate, "yyyy-MM-dd") : <span>날짜 선택</span>}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={p.requestDate} onSelect={(date) => handleInputChange(index, 'requestDate', date)} initialFocus /></PopoverContent>
                                                </Popover>
                                            </TableCell>
                                            <TableCell>{startDate ? format(startDate, 'yyyy-MM-dd') : '-'}</TableCell>
                                            <TableCell>{endDate ? format(endDate, 'yyyy-MM-dd') : '-'}</TableCell>
                                            <TableCell className="font-bold text-lg text-green-600 text-right">{estimate.toLocaleString()}원</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                {totalAmount > 0 && (
                     <CardFooter className="flex flex-col items-end gap-2 text-right">
                         <div className="text-sm text-muted-foreground">견적 합계: {quoteTotal.toLocaleString()}원</div>
                         <div className="text-sm text-muted-foreground">수수료 (10%): {totalCommission.toLocaleString()}원</div>
                         <div className="font-semibold">총 결제 금액: {totalAmount.toLocaleString()}원</div>
                         <Separator className="my-2"/>
                         <div className="flex items-center space-x-2">
                            <Label htmlFor="use-deposit" className="text-sm">예치금 사용 ({deposit.toLocaleString()}원 보유):</Label>
                            <input type="checkbox" id="use-deposit" checked={useDeposit} onChange={(e) => setUseDeposit(e.target.checked)} disabled={deposit === 0} className="h-4 w-4 accent-primary"/>
                         </div>
                         {useDeposit && <div className="text-destructive font-semibold">- {amountToUseFromDeposit.toLocaleString()}원</div>}
                         <Separator className="my-2"/>
                         <div className="text-xl font-bold">최종 결제 금액: <span className="text-primary">{remainingPayment.toLocaleString()}</span>원</div>
                        <Button onClick={handleProcessPayment} size="lg" className="mt-4">입금하기</Button>
                    </CardFooter>
                )}
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>나의 트래픽 예약 내역</CardTitle>
                    <CardDescription>DB에 저장된 나의 트래픽 요청 목록입니다.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>요청일자</TableHead>
                                    <TableHead>상품명</TableHead>
                                    <TableHead>개수</TableHead>
                                    <TableHead>입금여부</TableHead>
                                    <TableHead>결제상태</TableHead>
                                    <TableHead>진행상태</TableHead>
                                    <TableHead className="text-right">총 견적</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {savedRequests.length === 0 ? (
                                    <TableRow><TableCell colSpan="7" className="h-24 text-center text-muted-foreground">예약 내역이 없습니다.</TableCell></TableRow>
                                ) : (
                                    savedRequests.map(req => (
                                        <TableRow key={req.id}>
                                            <TableCell>{req.requestDate?.seconds ? formatDateWithDay(new Date(req.requestDate.seconds * 1000)) : '-'}</TableCell>
                                            <TableCell className="font-medium">{req.name}</TableCell>
                                            <TableCell>{req.quantity}</TableCell>
                                            <TableCell><input type="checkbox" checked={!!req.paymentReceived} onChange={(e) => handleDepositChange(req.id, e.target.checked)} title="입금 완료 시 체크" /></TableCell>
                                            <TableCell><Badge variant={req.paymentReceived ? "default" : "outline"}>{req.paymentReceived ? '입금완료' : '입금전'}</Badge></TableCell>
                                            <TableCell>
                                                {req.paymentReceived ? (
                                                    req.status === '예약 확정' ? <Badge>예약확정</Badge> : (
                                                    <AlertDialog open={confirmRequest?.id === req.id} onOpenChange={(open) => !open && setConfirmRequest(null)}>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="outline" size="sm" onClick={() => setConfirmRequest(req)}>예약확정</Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>예약을 확정하시겠습니까?</AlertDialogTitle></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>아니오</AlertDialogCancel><AlertDialogAction onClick={handleConfirmReservation}>예</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                    )
                                                ) : <Badge variant="secondary">예약중</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">{req.finalItemAmount?.toLocaleString()}원</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={showDepositPopup} onOpenChange={handleClosePopupAndReset}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>입금 계좌 안내</DialogTitle>
                        <DialogDescription>아래 계좌로 <strong className="text-primary">{remainingPayment.toLocaleString()}원</strong>을 입금해주세요.</DialogDescription>
                    </DialogHeader>
                    <div className="my-4 p-4 bg-muted rounded-md text-center">
                        <p className="font-semibold">채종문 (아이언마운틴컴퍼니)</p>
                        <p className="font-bold text-lg text-primary mt-1">국민은행 834702-04-290385</p>
                    </div>
                    <p className="text-sm text-center text-muted-foreground">입금 확인 후 '나의 트래픽 예약 내역'에서 상태가 변경됩니다.</p>
                     <DialogFooter>
                        <Button onClick={handleClosePopupAndReset} className="w-full">확인</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}