// src/pages/seller/SellerReservation.jsx (좌표 동적 계산 로직 추가 완료)

import { useState, useEffect, useMemo, useRef } from 'react'; // useRef 임포트 추가
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { db, auth, onAuthStateChanged, collection, serverTimestamp, query, where, onSnapshot, writeBatch, doc, increment, updateDoc, signOut, deleteDoc, addDoc } from '../../firebaseConfig';
import { nanoid } from 'nanoid';
import { format } from "date-fns";
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon, Trash2, CheckCircle, Search, AlertTriangle, MousePointer2 } from "lucide-react";
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

import axios from 'axios';
import hmacSHA256 from 'crypto-js/hmac-sha256';
import { toAbsoluteUrl } from '../../utils';

// --- shadcn/ui 컴포넌트 임포트 ---
import { Button, buttonVariants } from "@/components/ui/button";
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
import { Checkbox } from "@/components/ui/checkbox";
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

// CoupangSearchResults 컴포넌트 문구 변경
function CoupangSearchResults({ results, isLoading, error }) {
    if (isLoading) return <div className="p-4 text-center text-muted-foreground">검색 중입니다...</div>;
    if (error) return <div className="p-4 text-center text-destructive">{error}</div>;

    if (results.length === 0) {
        return (
            <div className="p-4 mt-4 text-left text-sm text-muted-foreground bg-muted/30 rounded-lg border space-y-3">
                <p className="font-semibold text-base text-foreground">💡 대표님, 키워드 검색 이렇게 활용해 보세요!</p>
                <ul className="space-y-2 pl-1">
                    <li className="flex items-start">
                        <span className="font-bold text-primary mr-2">1.</span>
                        <div>
                            <strong>상세 필터로 정확하게!</strong><br />
                            가격검색 필터와 상세 필터를 적용하면 대표님 상품을 더 쉽게 찾을 수 있습니다.
                        </div>
                    </li>
                    <li className="flex items-start">
                        <span className="font-bold text-primary mr-2">2.</span>
                        <div>
                            <strong>키워드 랭킹 1위를 향한 첫걸음!</strong><br />
                            대표님 상품이 검색된다면, 저희와 함께 키워드 랭킹 최상단에 도전해보세요!
                        </div>
                    </li>
                </ul>
                <p className="text-center pt-2 font-medium">
                    우선, 위 검색창에서 대표님의 상품이 노출되는지 확인해 보세요.
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 max-h-96 overflow-y-auto p-1">
            {results.map((item, index) => (
                <a key={index} href={toAbsoluteUrl(item.productUrl)} target="_blank" rel="noopener noreferrer" className="block border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
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
    
    const [isVatApplied, setIsVatApplied] = useState(true);
    const [selectedSavedCampaigns, setSelectedSavedCampaigns] = useState([]);
    const [editedRows, setEditedRows] = useState({});
    const [deleteConfirmation, setDeleteConfirmation] = useState(null);
    const [paymentAmountInPopup, setPaymentAmountInPopup] = useState(0);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [savedTemplates, setSavedTemplates] = useState([]);
    const [showTemplateDialog, setShowTemplateDialog] = useState(false);
    const [templateSearch, setTemplateSearch] = useState('');
    const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);

    const filteredTemplates = useMemo(() => {
        const keyword = templateSearch.trim().toLowerCase();
        if (!keyword) return savedTemplates;
        return savedTemplates.filter(t =>
            `${t.productName} ${t.productOption}`.toLowerCase().includes(keyword)
        );
    }, [savedTemplates, templateSearch]);
    
    // [추가] 애니메이션을 위한 ref와 state
    const animationContainerRef = useRef(null);
    const searchButtonRef = useRef(null);
    const [animationStyle, setAnimationStyle] = useState({});

    const calculateTotals = (currentCampaigns) => {
        let totalSubtotal = 0;
        currentCampaigns.forEach(c => {
            const cDate = c.date instanceof Date ? c.date : new Date();
            const reviewFee = getBasePrice(c.deliveryType, c.reviewType) + (cDate.getDay() === 0 ? 600 : 0);
            const productPriceWithAgencyFee = Number(c.productPrice) * 1.1;
            const subtotalPerItem = reviewFee + productPriceWithAgencyFee;
            totalSubtotal += subtotalPerItem * Number(c.quantity);
        });

        const totalAmount = isVatApplied ? totalSubtotal * 1.1 : totalSubtotal;
        const totalVat = totalAmount - totalSubtotal;
        const amountToUseFromDeposit = useDeposit ? Math.min(totalAmount, deposit) : 0;
        const remainingPayment = Math.ceil(totalAmount - amountToUseFromDeposit);

        return {
            totalSubtotal: Math.round(totalSubtotal),
            totalVat: Math.round(totalVat),
            totalAmount: Math.round(totalAmount),
            amountToUseFromDeposit: Math.round(amountToUseFromDeposit),
            remainingPayment,
        };
    };

    const { basePrice, sundayExtraCharge, finalUnitPrice } = useMemo(() => {
        const basePrice = getBasePrice(formState.deliveryType, formState.reviewType);
        const sundayExtraCharge = formState.date.getDay() === 0 ? 600 : 0;
        const finalUnitPrice = basePrice + sundayExtraCharge;
        return { basePrice, sundayExtraCharge, finalUnitPrice };
    }, [formState.deliveryType, formState.reviewType, formState.date]);
    
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
                    if (doc.exists()) { const data = doc.data(); setDeposit(data.deposit || 0); setNickname(data.nickname || currentUser.email); }
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
                listeners.push(onSnapshot(
                    query(collection(db, 'productTemplates'), where('sellerUid', '==', currentUser.uid)),
                    (snap) => {
                        const templates = snap.docs.map((d) => {
                            const data = d.data();
                            if (data.date?.seconds) {
                                data.date = new Date(data.date.seconds * 1000);
                            }
                            return { id: d.id, ...data };
                        });
                        setSavedTemplates(templates);
                    }
                ));
                setIsLoading(false);
                return () => listeners.forEach(unsub => unsub());
            } else {
                setUser(null); setIsLoading(false); navigate('/seller-login');
            }
        });
        return () => unsubscribeAuth();
    }, [navigate]);

    // [추가] 애니메이션 좌표 계산을 위한 useEffect
    useEffect(() => {
        if (searchKeyword.trim() && !isSearching && animationContainerRef.current && searchButtonRef.current) {
            const containerRect = animationContainerRef.current.getBoundingClientRect();
            const buttonRect = searchButtonRef.current.getBoundingClientRect();

            // 시작점: 컨테이너 좌측 바깥, 수직 중앙
            const startX = -20;
            const startY = containerRect.height / 2;

            // 끝점: 버튼의 중앙 (컨테이너 기준 상대 좌표)
            const targetX = (buttonRect.left - containerRect.left) + (buttonRect.width / 2);
            const targetY = (buttonRect.top - containerRect.top) + (buttonRect.height / 2);

            setAnimationStyle({
                '--mouse-start-x': `${startX}px`,
                '--mouse-start-y': `${startY}px`,
                '--mouse-end-x': `${targetX}px`,
                '--mouse-end-y': `${targetY}px`,
            });
        }
    }, [searchKeyword, isSearching]);


    const handleFormChange = (name, value) => setFormState(prev => ({ ...prev, [name]: value }));
    const handleDateSelect = (date) => { handleFormChange('date', date); setIsDatePickerOpen(false); };
    const handleSaveTemplate = async () => {
        if (!user) return;
        const templateData = { ...formState, sellerUid: user.uid, updatedAt: serverTimestamp() };
        const existing = savedTemplates.find(
            t => t.productUrl === formState.productUrl && t.productOption === formState.productOption
        );
        try {
            if (existing) {
                await updateDoc(doc(db, 'productTemplates', existing.id), templateData);
            } else {
                await addDoc(collection(db, 'productTemplates'), { ...templateData, createdAt: serverTimestamp() });
            }
            setShowSaveSuccess(true);
        } catch (err) {
            console.error('템플릿 저장 오류:', err);
        }
    };

    const handleDeleteTemplate = async (id) => {
        try {
            await deleteDoc(doc(db, 'productTemplates', id));
        } catch (err) {
            console.error('템플릿 삭제 오류:', err);
        }
    };

    const handleDeleteSelectedTemplates = async () => {
        if (selectedTemplateIds.length === 0) return;
        const batch = writeBatch(db);
        selectedTemplateIds.forEach(tid => batch.delete(doc(db, 'productTemplates', tid)));
        try {
            await batch.commit();
            setSelectedTemplateIds([]);
        } catch (err) {
            console.error('템플릿 삭제 오류:', err);
        }
    };

    const handleSelectTemplate = (id, checked) => {
        setSelectedTemplateIds(prev =>
            checked ? [...prev, id] : prev.filter(tid => tid !== id)
        );
    };
    const handleAddCampaign = (e) => {
        e.preventDefault();
        const newCampaign = { id: nanoid(), ...formState };
        if (!formState.productOption.trim()) { setPendingCampaign(newCampaign); }
        else { setCampaigns(prev => [...prev, newCampaign]); setFormState(initialFormState); }
    };
    const handleConfirmAddCampaign = () => {
        if (pendingCampaign) {
            setCampaigns(prev => [...prev, pendingCampaign]);
            setFormState(initialFormState);
            setPendingCampaign(null); 
        }
    };
    const handleDeleteCampaign = (id) => setCampaigns(campaigns.filter(c => c.id !== id));
    
    const handleProcessPayment = async () => {
        if (campaigns.length === 0 || !user) { alert('견적에 추가된 캠페인이 없습니다.'); return; }
        
        const { remainingPayment, amountToUseFromDeposit } = calculateTotals(campaigns);
        const batch = writeBatch(db);
        const sellerDocRef = doc(db, 'sellers', user.uid);
        const isFullDepositPayment = remainingPayment <= 0;
        const groupId = nanoid();

        campaigns.forEach(campaign => {
            const campaignRef = doc(collection(db, 'campaigns'));
            const { id, ...campaignData } = campaign;
            const cDate = campaign.date instanceof Date ? campaign.date : new Date();
            const reviewFee = getBasePrice(campaign.deliveryType, campaign.reviewType) + (cDate.getDay() === 0 ? 600 : 0);
            const productPriceWithAgencyFee = Number(campaign.productPrice) * 1.1;
            const subtotalPerItem = reviewFee + productPriceWithAgencyFee;
            const totalSubtotal = subtotalPerItem * Number(campaign.quantity);
            const finalTotalAmount = isVatApplied ? totalSubtotal * 1.1 : totalSubtotal;

            batch.set(campaignRef, {
                ...campaignData,
                sellerUid: user.uid,
                groupId,
                createdAt: serverTimestamp(),
                status: '예약 대기',
                paymentReceived: isFullDepositPayment,
                isVatApplied,
                reviewFee,
                productPriceWithAgencyFee,
                subtotal: Math.round(totalSubtotal),
                vat: Math.round(finalTotalAmount - totalSubtotal),
                finalTotalAmount: Math.round(finalTotalAmount),
            });
        });

        if (useDeposit && amountToUseFromDeposit > 0) { batch.update(sellerDocRef, { deposit: increment(-amountToUseFromDeposit) }); }

        try {
            await batch.commit();
            if (!isFullDepositPayment) { 
                setPaymentAmountInPopup(remainingPayment);
                setShowDepositPopup(true); 
            } else { 
                alert('예치금으로 결제가 완료되어 예약이 접수되었습니다.');
            }
            setCampaigns([]);
        } catch (error) { console.error("결제 처리 중 오류 발생: ", error); alert('오류가 발생하여 결제를 완료하지 못했습니다.'); }
    };

    const handleDepositCheckboxChange = (id, checked) => {
      if (checked) { setConfirmationDialogData({ ids: [id], checked }); } else { updateDepositStatus([id], checked); }
    };
    const updateDepositStatus = async (ids, checked) => {
      const batch = writeBatch(db);
      (Array.isArray(ids) ? ids : [ids]).forEach((cId) => {
        batch.update(doc(db, 'campaigns', cId), { paymentReceived: checked });
      });
      try { await batch.commit(); } catch (err) { console.error('입금 여부 업데이트 오류:', err); }
    };
    const handleLogout = async () => { try { await signOut(auth); navigate('/seller-login'); } catch (error) { console.error("로그아웃 실패:", error); } };
    const handleKeywordSearch = async () => {
        if (!searchKeyword.trim()) { setSearchError("검색어를 입력해주세요."); setSearchResults([]); return; }
        setIsSearching(true); setSearchError(''); setSearchResults([]);
        const ACCESS_KEY = import.meta.env.VITE_COUPANG_ACCESS_KEY;
        const SECRET_KEY = import.meta.env.VITE_COUPANG_SECRET_KEY;
        if (!ACCESS_KEY || !SECRET_KEY) { setSearchError("API 키가 설정되지 않았습니다."); setIsSearching(false); return; }
        const API_METHOD = "GET", API_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search", DOMAIN = "https://api-gateway.coupang.com";
        const datetime = (new Date()).toISOString().substr(0, 19) + "Z";
        const query = `keyword=${encodeURIComponent(searchKeyword)}&limit=10`;
        const stringToSign = datetime + API_METHOD + API_PATH.replace(/\?/g, "") + query;
        const signature = hmacSHA256(stringToSign, SECRET_KEY).toString();
        const authorization = `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
        const url = `${DOMAIN}${API_PATH}?${query}`;
        try {
            const response = await axios.get(url, { headers: { "Authorization": authorization } });
            if (response.data?.rData?.productData) { setSearchResults(response.data.rData.productData); } else { setSearchResults([]); }
        } catch (error) { console.error("Coupang API error:", error); setSearchError("검색 중 오류가 발생했습니다."); } 
        finally { setIsSearching(false); }
    };
    
    const handleKeywordSync = (e) => {
        const { value } = e.target;
        handleFormChange('keywords', value);
        setSearchKeyword(value);
    };

    const renderDayCell = (dayCellInfo) => {
        const dateStr = formatDateForCalendar(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        const dailyEvents = calendarCampaigns.filter(c => c.status === '예약 확정' && formatDateForCalendar(c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date)) === dateStr);
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.quantity || 0), 0);
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-destructive';

        return (
            <div className="flex flex-col h-full p-1">
                <div className="text-right text-xs text-muted-foreground">{dayCellInfo.dayNumberText}</div>
                <div className="flex flex-col items-center justify-center flex-grow">
                    <div className="text-[10px] text-muted-foreground">잔여</div>
                    <span className={`text-lg font-bold ${remainingColor}`}>{remaining}</span>
                </div>
            </div>
        );
    };

    const handleDeleteSavedCampaigns = async () => {
        if (!deleteConfirmation || !deleteConfirmation.ids || deleteConfirmation.ids.length === 0) return;
        const idsToDelete = deleteConfirmation.ids;
        const batch = writeBatch(db);
        idsToDelete.forEach(id => { batch.delete(doc(db, 'campaigns', id)); });
        try {
            await batch.commit();
            setSelectedSavedCampaigns(prev => prev.filter(id => !idsToDelete.includes(id)));
            setDeleteConfirmation(null);
        } catch (error) { console.error("캠페인 삭제 오류:", error); alert("삭제 중 오류 발생."); }
    };

const handleSelectSavedCampaign = (id, checked) => { setSelectedSavedCampaigns(prev => checked ? [...prev, id] : prev.filter(item => item !== id)); };
const handleSelectAllSavedCampaigns = (checked) => { setSelectedSavedCampaigns(checked ? savedCampaigns.map(c => c.id) : []); };
    const handleRowChange = (id, field, value) => {
        setEditedRows(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: value }
        }));
    };

    const isRowModified = (c) => {
        const edited = editedRows[c.id];
        if (!edited) return false;
        return (
            (edited.deliveryType ?? c.deliveryType) !== c.deliveryType ||
            (edited.reviewType ?? c.reviewType) !== c.reviewType ||
            Number(edited.quantity ?? c.quantity) !== Number(c.quantity)
        );
    };

    const applyRowChanges = async (id) => {
        const original = savedCampaigns.find(sc => sc.id === id);
        const edited = editedRows[id];
        if (!original || !edited) return;

        const deliveryType = edited.deliveryType ?? original.deliveryType;
        const reviewType = edited.reviewType ?? original.reviewType;
        const quantity = Number(edited.quantity ?? original.quantity);
        const cDate = original.date?.seconds ? new Date(original.date.seconds * 1000) : new Date();
        const reviewFee = getBasePrice(deliveryType, reviewType) + (cDate.getDay() === 0 ? 600 : 0);
        const productPriceWithAgencyFee = Number(original.productPrice) * 1.1;
        const subtotal = (reviewFee + productPriceWithAgencyFee) * quantity;
        const finalAmount = original.isVatApplied ? subtotal * 1.1 : subtotal;

        try {
            await updateDoc(doc(db, 'campaigns', id), {
                deliveryType,
                reviewType,
                quantity,
                reviewFee,
                productPriceWithAgencyFee,
                subtotal: Math.round(subtotal),
                vat: Math.round(finalAmount - subtotal),
                finalTotalAmount: Math.round(finalAmount)
            });
            setEditedRows(prev => {
                const copy = { ...prev };
                delete copy[id];
                return copy;
            });
        } catch (err) {
            console.error('캠페인 업데이트 오류:', err);
        }
    };
    const handleBulkDepositRequest = () => {
        const targets = savedCampaigns
            .filter(c => selectedSavedCampaigns.includes(c.id) && !c.paymentReceived)
            .map(c => c.id);
        if (targets.length === 0) return;
        setConfirmationDialogData({ ids: targets, checked: true });
    };

    if (isLoading) return <div className="flex justify-center items-center h-screen"><p>데이터를 불러오는 중입니다...</p></div>;
    
    const { totalSubtotal, totalVat, totalAmount, amountToUseFromDeposit, remainingPayment } = calculateTotals(campaigns);
    const pendingDepositCount = savedCampaigns.filter(c => selectedSavedCampaigns.includes(c.id) && !c.paymentReceived).length;

    return (
        <>
            {/* [수정] CSS 변수를 사용하도록 @keyframes 수정 */}
            <style>
                {`
                @keyframes moveAndClick {
                  0% {
                    opacity: 0;
                    transform: translate(var(--mouse-start-x, -150px), var(--mouse-start-y, 0px)) scale(1);
                  }
                  10% {
                    opacity: 1;
                    transform: translate(var(--mouse-start-x, -150px), var(--mouse-start-y, 0px)) scale(1);
                  }
                  60% {
                    opacity: 1;
                    transform: translate(var(--mouse-end-x, 115px), var(--mouse-end-y, 0px)) scale(1);
                  }
                  75% {
                    transform: translate(var(--mouse-end-x, 115px), var(--mouse-end-y, 0px)) scale(0.85);
                  }
                  90% {
                    opacity: 1;
                    transform: translate(var(--mouse-end-x, 115px), var(--mouse-end-y, 0px)) scale(1);
                  }
                  100% {
                    opacity: 0;
                    transform: translate(var(--mouse-end-x, 115px), var(--mouse-end-y, 0px)) scale(1);
                  }
                }
                .animate-mouse-pointer {
                  animation: moveAndClick 2.5s ease-in-out forwards;
                }
              `}
            </style>

            <div className="mb-6 flex flex-wrap items-center justify-between gap-4 p-4 bg-card border rounded-lg shadow-sm">
                <div className="flex items-center space-x-4">
                    <div className="text-sm font-semibold">
                        <span className="text-muted-foreground">보유 예치금:</span>
                        <span className="ml-2 text-lg text-primary">{deposit.toLocaleString()}원</span>
                    </div>
                    <div className="flex items-center space-x-2 border-l pl-4">
                        <Checkbox id="use-deposit-global" checked={useDeposit} onCheckedChange={setUseDeposit} disabled={deposit === 0 || totalAmount === 0} />
                        <Label htmlFor="use-deposit-global" className="text-sm font-medium">견적 결제 시 예치금 사용</Label>
                    </div>
                </div>
                <Button onClick={handleLogout} variant="outline" size="sm">로그아웃</Button>
            </div>

            <div className="space-y-8">
                <Card>
                    <form onSubmit={handleAddCampaign}>
                        <CardHeader className="items-center space-y-2">
                            <CardTitle>새 작업 추가</CardTitle>
                            <CardDescription>진행할 리뷰 캠페인의 정보를 입력하고 견적에 추가하세요.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid lg:grid-cols-3 gap-8">
                            <div className="space-y-4 p-4 border rounded-lg h-full">
                                <div>
                                    <Label htmlFor="date">진행 일자</Label>
                                    <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button id="date" variant={"outline"} className={cn( "w-full justify-start text-left font-normal", !formState.date && "text-muted-foreground" )}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />{formState.date ? format(formState.date, "PPP", {locale: ko}) : <span>날짜 선택</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formState.date} onSelect={handleDateSelect} initialFocus /></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="text-xs">
                                    <FullCalendar 
                                        plugins={[dayGridPlugin, interactionPlugin]} 
                                        initialView="dayGridMonth" 
                                        headerToolbar={{ left: 'prev', center: 'title', right: 'next' }} 
                                        events={calendarEvents} 
                                        dayCellContent={renderDayCell}
                                        dayCellClassNames={(arg) => {
                                            const dateStr = formatDateForCalendar(arg.date);
                                            const capacity = capacities[dateStr] || 0;
                                            const dailyEvents = calendarCampaigns.filter(c => c.status === '예약 확정' && formatDateForCalendar(c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date)) === dateStr);
                                            const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.quantity || 0), 0);
                                            const remaining = capacity - totalQuantity;
                                            if (remaining > 0 && capacity > 0) return 'cursor-pointer hover:bg-muted';
                                            return '';
                                        }}
                                        dateClick={(info) => {
                                            const dateStr = info.dateStr;
                                            const capacity = capacities[dateStr] || 0;
                                            const dailyEvents = calendarCampaigns.filter(c => c.status === '예약 확정' && formatDateForCalendar(c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date)) === dateStr);
                                            const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.quantity || 0), 0);
                                            const remaining = capacity - totalQuantity;
                                            if (remaining > 0 && capacity > 0) setFormState(prev => ({ ...prev, date: info.date }));
                                            else alert('해당 날짜는 예약이 마감되었습니다.');
                                        }}
                                        locale="ko" 
                                        height="auto" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg h-full">
                                <div className="flex justify-center gap-2">
                                    <Button type="button" size="sm" variant="outline" onClick={handleSaveTemplate}>지금 작성하는 상품 저장하기</Button>
                                    <Button type="button" size="sm" variant="outline" onClick={() => setShowTemplateDialog(true)}>저장된 상품 불러오기</Button>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div><Label htmlFor="deliveryType">구분</Label><Select name="deliveryType" value={formState.deliveryType} onValueChange={(v) => handleFormChange('deliveryType', v)}><SelectTrigger id="deliveryType"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="실배송">실배송</SelectItem><SelectItem value="빈박스">빈박스</SelectItem></SelectContent></Select></div>
                                    <div><Label htmlFor="reviewType">리뷰 종류</Label><Select name="reviewType" value={formState.reviewType} onValueChange={(v) => handleFormChange('reviewType', v)}><SelectTrigger id="reviewType"><SelectValue/></SelectTrigger><SelectContent>{formState.deliveryType === '실배송' ? (<><SelectItem value="별점">별점</SelectItem><SelectItem value="텍스트">텍스트</SelectItem><SelectItem value="포토">포토</SelectItem><SelectItem value="프리미엄(포토)">프리미엄(포토)</SelectItem><SelectItem value="프리미엄(영상)">프리미엄(영상)</SelectItem></>) : (<><SelectItem value="별점">별점</SelectItem><SelectItem value="텍스트">텍스트</SelectItem></>)}</SelectContent></Select></div>
                                    <div><Label htmlFor="quantity">체험단 개수</Label><Input id="quantity" type="number" name="quantity" value={formState.quantity} onChange={(e) => handleFormChange('quantity', e.target.value)} min="1" required /></div>
                                </div>
                                <div>
                                    <Label htmlFor="productUrl">상품 URL</Label><Input id="productUrl" type="url" name="productUrl" value={formState.productUrl} onChange={(e) => handleFormChange('productUrl', e.target.value)} placeholder="https://..." />
                                </div>
                                <div>
                                    <Label htmlFor="productName">상품명</Label><Input id="productName" name="productName" value={formState.productName} onChange={(e) => handleFormChange('productName', e.target.value)} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label htmlFor="productOption">옵션</Label><Input id="productOption" name="productOption" value={formState.productOption} onChange={(e) => handleFormChange('productOption', e.target.value)} /></div>
                                    <div><Label htmlFor="productPrice">상품가</Label><Input id="productPrice" type="number" name="productPrice" value={formState.productPrice} onChange={(e) => handleFormChange('productPrice', e.target.value)} placeholder="0" /></div>
                                </div>
                                <div>
                                    <Label htmlFor="keywords">키워드 (1개)</Label>
                                    <Input id="keywords" name="keywords" value={formState.keywords} onChange={handleKeywordSync} />
                                </div>
                                <div className="p-4 border rounded-lg bg-muted/40 space-y-3">
                                    <Label htmlFor="coupangSearch" className="font-semibold">해당 키워드로 대표님 상품이 검색이 되는지 확인해 보셨나요?</Label>
                                    {/* [수정] ref를 컨테이너와 버튼에 연결 */}
                                    <div ref={animationContainerRef} className="relative flex space-x-2">
                                        <Input id="coupangSearch" placeholder="키워드 입력 후 검색" value={searchKeyword} onChange={e => setSearchKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleKeywordSearch())} />
                                        <Button
                                            ref={searchButtonRef}
                                            type="button"
                                            onClick={handleKeywordSearch}
                                            disabled={isSearching}
                                            className={cn(searchKeyword.trim() && !isSearching && 'animate-pulse')}
                                        >
                                            <Search className="h-4 w-4"/>
                                        </Button>
                                        {/* [수정] 동적 스타일 적용 및 초기 위치 수정 */}
                                        <MousePointer2
                                            className={cn(
                                                "w-5 h-5 absolute text-primary-foreground bg-primary p-1 rounded-full shadow-lg pointer-events-none",
                                                "opacity-0", 
                                                searchKeyword.trim() && !isSearching && "animate-mouse-pointer"
                                            )}
                                            style={{ ...animationStyle, left: 0, top: 0, transformOrigin: 'top left' }}
                                        />
                                    </div>
                                    <CoupangSearchResults results={searchResults} isLoading={isSearching} error={searchError} />
                                </div>
                            </div>

                            <div className="space-y-4 p-4 border rounded-lg h-full flex flex-col">
                                <div className="flex-grow flex flex-col">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <Label htmlFor="reviewGuide">리뷰 가이드</Label>
                                        <span className="text-xs text-muted-foreground">{formState.reviewGuide.length} / 200</span>
                                    </div>
                                    <Textarea 
                                        id="reviewGuide" 
                                        name="reviewGuide" 
                                        value={formState.reviewGuide} 
                                        onChange={(e) => handleFormChange('reviewGuide', e.target.value)} 
                                        disabled={formState.reviewType === '별점'} 
                                        className="flex-grow" 
                                        maxLength="200"
                                        placeholder="경우에 따라 가이드 내용이 반려될 수 있습니다"
                                    />
                                </div>
                                <div className="flex-grow flex flex-col">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <Label htmlFor="remarks">비고</Label>
                                        <span className="text-xs text-muted-foreground">{formState.remarks.length} / 200</span>
                                    </div>
                                    <Textarea 
                                        id="remarks" 
                                        name="remarks" 
                                        value={formState.remarks} 
                                        onChange={(e) => handleFormChange('remarks', e.target.value)} 
                                        className="flex-grow" 
                                        maxLength="200" 
                                    />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center flex-wrap gap-4">
                            <div className="flex items-center space-x-2 text-sm">
                                <span>단가: {basePrice.toLocaleString()}원</span>
                                {sundayExtraCharge > 0 && <span className="text-destructive">+ 공휴일 {sundayExtraCharge.toLocaleString()}원</span>}
                                <span className="font-semibold">= 체험단 진행비 {finalUnitPrice.toLocaleString()}원</span>
                                <PriceListDialog />
                            </div>
                            <Button type="submit" size="lg">견적에 추가</Button>
                        </CardFooter>
                    </form>
                </Card>

                {/* --- 이하 코드는 변경사항 없음 --- */}
                <Card>
                    <CardHeader><CardTitle>견적 목록(스프레드시트)</CardTitle><CardDescription>결제를 진행할 캠페인 목록입니다.<br/>- 품절 등으로 진행 불가 시 상품가만 예치금으로 전환됩니다.<br/>- 대표님 귀책 사유로 세금계산서 변경 시 수수료 10,000원 부과됩니다.<br/>- 견적 상세 = [체험단 진행비 + 상품가 × (1 + 대행수수료 10%)] × 수량 {isVatApplied && "× (1 + 부가세 10%)"}</CardDescription></CardHeader>
                    <CardContent><div className="border rounded-md"><Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>일자</TableHead>
                                <TableHead className="text-center">구분</TableHead>
                                <TableHead className="text-center">리뷰</TableHead>
                                <TableHead className="text-center">수량</TableHead>
                                <TableHead>상품명</TableHead>
                                <TableHead className="text-center">개별견적</TableHead>
                                <TableHead className="text-center">결제 금액</TableHead>
                                <TableHead>삭제</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>{campaigns.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan="8" className="h-24 text-center text-muted-foreground">
                                    위에서 작업을 추가해주세요.
                                </TableCell>
                            </TableRow>
                        ) : (
                            campaigns.map((c, idx) => {
                            const cDate = c.date instanceof Date ? c.date : new Date();
                            const reviewFee = getBasePrice(c.deliveryType, c.reviewType) + (cDate.getDay() === 0 ? 600 : 0);
                            const productPriceWithAgencyFee = Number(c.productPrice) * 1.1;
                            const subtotal = reviewFee + productPriceWithAgencyFee;
                            const unitFinal = isVatApplied ? subtotal * 1.1 : subtotal;

                            return (
                                <TableRow key={c.id}>
                                <TableCell className={cDate.getDay() === 0 ? 'text-destructive font-semibold' : ''}>
                                    {formatDateWithDay(cDate)}
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline">{c.deliveryType}</Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge>{c.reviewType}</Badge>
                                </TableCell>
                                <TableCell className="text-center">{c.quantity}</TableCell>
                                <TableCell className="font-medium">{c.productName}</TableCell>
                                <TableCell className="text-center">
                                    {Math.round(unitFinal).toLocaleString()}원
                                </TableCell>
                                {idx === 0 && (
                                    <TableCell
                                        rowSpan={campaigns.length}
                                        className="font-semibold text-center align-middle"
                                    >
                                        {remainingPayment.toLocaleString()}원
                                    </TableCell>
                                )}
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDeleteCampaign(c.id)}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        );
                    })
                        )}
                        </TableBody>
                    </Table>
                    </div>
                    </CardContent>
                    {campaigns.length > 0 && (<CardFooter className="flex flex-col items-end gap-2 text-right">
                        <div className="text-sm text-muted-foreground">공급가액 합계: {totalSubtotal.toLocaleString()}원</div>
                        <div className="text-sm text-muted-foreground">부가세 (10%): {totalVat.toLocaleString()}원</div>
                        <div className="font-semibold">총 결제 금액: {totalAmount.toLocaleString()}원</div>
                        {useDeposit && (<><Separator className="my-2"/><div className="text-sm"><span className="text-muted-foreground">예치금 사용: </span><span className="font-semibold text-destructive">- {amountToUseFromDeposit.toLocaleString()}원</span></div></>)}
                        <Separator className="my-2"/>
                        <div className="text-xl font-bold">최종 결제 금액: <span className="text-primary">{remainingPayment.toLocaleString()}</span>원</div>
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
                        <div className="flex space-x-2">
                            <Button onClick={handleBulkDepositRequest} disabled={pendingDepositCount === 0}>
                                입금 확인 요청 ({pendingDepositCount})
                            </Button>
                            <Button variant="destructive" onClick={() => setDeleteConfirmation({ type: 'multiple', ids: selectedSavedCampaigns })} disabled={selectedSavedCampaigns.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                선택 항목 삭제 ({selectedSavedCampaigns.length})
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox onCheckedChange={handleSelectAllSavedCampaigns} checked={savedCampaigns.length > 0 && selectedSavedCampaigns.length === savedCampaigns.length} aria-label="모두 선택" />
                                        </TableHead>
                                        <TableHead className="w-[140px] text-center">일자</TableHead>
                                        <TableHead>상품명</TableHead>
                                        <TableHead className="w-[80px] text-center">구분</TableHead>
                                        <TableHead className="w-[120px] text-center">리뷰</TableHead>
                                        <TableHead className="w-[60px] text-center">수량</TableHead>
                                        <TableHead className="w-[60px] text-center">입금</TableHead>
                                        <TableHead className="w-[100px] text-center">상태</TableHead>
                                        <TableHead className="w-[120px] text-center">개별견적</TableHead>
                                        <TableHead className="w-[120px] text-center">결제금액</TableHead>
                                        <TableHead className="w-[80px] text-center">관리</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {savedCampaigns.length === 0 ? (
                                        <TableRow><TableCell colSpan="11" className="h-24 text-center text-muted-foreground">예약 내역이 없습니다.</TableCell></TableRow>
                                    ) : (
                                        savedCampaigns.map(c => {
                                            const row = editedRows[c.id] || {};
                                            const deliveryType = row.deliveryType ?? c.deliveryType;
                                            const reviewType = row.reviewType ?? c.reviewType;
                                            const quantity = Number(row.quantity ?? c.quantity);
                                            const cDate = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date();
                                            const reviewFee = getBasePrice(deliveryType, reviewType) + (cDate.getDay() === 0 ? 600 : 0);
                                            const productPriceWithAgencyFee = Number(c.productPrice) * 1.1;
                                            const unitSubtotal = reviewFee + productPriceWithAgencyFee;
                                            const unitFinal = c.isVatApplied ? unitSubtotal * 1.1 : unitSubtotal;
                                            const finalAmount = unitFinal * quantity;

                                            return (
                                                <TableRow key={c.id}>
                                                    <TableCell>
                                                        <Checkbox checked={selectedSavedCampaigns.includes(c.id)} onCheckedChange={(checked) => handleSelectSavedCampaign(c.id, checked)} aria-label={`${c.productName} 선택`} />
                                                    </TableCell>
                                                    <TableCell className="text-center">{c.date?.seconds ? formatDateWithDay(new Date(c.date.seconds * 1000)) : '-'}</TableCell>
                                                    <TableCell className="font-medium">{c.productName}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Select value={deliveryType} onValueChange={(v) => handleRowChange(c.id, 'deliveryType', v)}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="실배송">실배송</SelectItem>
                                                                <SelectItem value="빈박스">빈박스</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Select value={reviewType} onValueChange={(v) => handleRowChange(c.id, 'reviewType', v)}>
                                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {deliveryType === '실배송' ? (
                                                                    <>
                                                                        <SelectItem value="별점">별점</SelectItem>
                                                                        <SelectItem value="텍스트">텍스트</SelectItem>
                                                                        <SelectItem value="포토">포토</SelectItem>
                                                                        <SelectItem value="프리미엄(포토)">프리미엄(포토)</SelectItem>
                                                                        <SelectItem value="프리미엄(영상)">프리미엄(영상)</SelectItem>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <SelectItem value="별점">별점</SelectItem>
                                                                        <SelectItem value="텍스트">텍스트</SelectItem>
                                                                    </>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Input type="number" className="w-20" value={quantity} min="1" onChange={(e) => handleRowChange(c.id, 'quantity', e.target.value)} />
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Checkbox
                                                            checked={!!c.paymentReceived}
                                                            onCheckedChange={(checked) => handleDepositCheckboxChange(c.id, checked)}
                                                            title="입금 완료 시 체크"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-center"><Badge variant={c.status === '예약 확정' ? 'default' : c.status === '예약 대기' ? 'secondary' : 'destructive'}>{c.status}</Badge></TableCell>
                                                    <TableCell className="text-center">{Math.round(unitFinal || 0).toLocaleString()}원</TableCell>
                                                    <TableCell className="text-center">{Math.round(finalAmount || 0).toLocaleString()}원</TableCell>
                                                    <TableCell className="text-center space-x-2">
                                                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmation({ type: 'single', ids: [c.id] })}>
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                        <Button size="sm" disabled={!isRowModified(c)} onClick={() => applyRowChanges(c.id)}>적용</Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                </CardContent>
                </Card>

                <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <div className="flex items-center justify-between space-x-2">
                                <DialogTitle>저장된 상품 불러오기</DialogTitle>
                                <div className="flex items-center space-x-2">
                                    <Input
                                        placeholder="검색"
                                        value={templateSearch}
                                        onChange={e => setTemplateSearch(e.target.value)}
                                        className="h-8"
                                    />
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={handleDeleteSelectedTemplates}
                                        disabled={selectedTemplateIds.length === 0}
                                    >
                                        선택삭제
                                    </Button>
                                </div>
                            </div>
                        </DialogHeader>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {filteredTemplates.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">저장된 상품이 없습니다.</p>
                            ) : (
                                filteredTemplates.map(t => {
                                    const { id, sellerUid, createdAt, updatedAt, ...rest } = t;
                                    return (
                                        <div key={id} className="flex items-center justify-between border-b py-2 space-x-2">
                                            <Checkbox
                                                checked={selectedTemplateIds.includes(id)}
                                                onCheckedChange={checked => handleSelectTemplate(id, checked)}
                                                aria-label="템플릿 선택"
                                            />
                                            <div className="flex-1">
                                                <p className="font-medium">{t.productName}</p>
                                                <p className="text-sm text-muted-foreground">{t.productOption}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDeleteTemplate(id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        const date = rest.date instanceof Date
                                                            ? rest.date
                                                            : rest.date?.seconds
                                                                ? new Date(rest.date.seconds * 1000)
                                                                : new Date();
                                                        const { date: _, sellerUid: __, createdAt: ___, updatedAt: ____, ...others } = rest;
                                                        setFormState((prev) => ({ ...prev, ...others, date }));
                                                        setShowTemplateDialog(false);
                                                    }}
                                                >
                                                    선택
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                </DialogContent>
                </Dialog>

                <Dialog open={showSaveSuccess} onOpenChange={setShowSaveSuccess}>
                    <DialogContent className="sm:max-w-md text-center space-y-4">
                        <p>입력한 내용이 저장됐습니다.<br/>저장된 상품 불러오기 버튼을 통해<br/>언제든 불러올 수 있습니다.</p>
                        <DialogFooter>
                            <Button className="w-full" onClick={() => setShowSaveSuccess(false)}>확인</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={showDepositPopup} onOpenChange={setShowDepositPopup}>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="text-2xl text-center font-bold">입금 계좌 안내</DialogTitle>
                            <DialogDescription className="text-center pt-2">
                                예약이 접수되었습니다. 아래 계좌로 <strong className="text-primary">{paymentAmountInPopup.toLocaleString()}원</strong>을 입금해주세요.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="my-6 p-6 bg-muted rounded-lg space-y-4 text-base sm:text-lg">
                        <div className="flex items-center"><span className="w-28 font-semibold text-muted-foreground">은 행</span><span>국민은행</span></div><div className="flex items-center"><span className="w-28 font-semibold text-muted-foreground">계좌번호</span><span className="font-mono tracking-wider">289537-00-006049</span></div><div className="flex items-center"><span className="w-28 font-semibold text-muted-foreground">예금주</span><span>아이언마운틴컴퍼니</span></div></div><Button onClick={() => setShowDepositPopup(false)} className="w-full h-12 text-lg mt-2">확인</Button></DialogContent></Dialog>
                <Dialog open={!!confirmationDialogData} onOpenChange={() => setConfirmationDialogData(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center space-x-2"><CheckCircle className="text-green-500" /><span>입금 확인 요청</span></DialogTitle>
                            <DialogDescription className="pt-4 text-base">
                                {confirmationDialogData?.ids?.length && confirmationDialogData.ids.length > 1
                                    ? `선택한 ${confirmationDialogData.ids.length}개 캠페인에 대한 입금 확인을 요청했습니다.`
                                    : '입금 확인을 요청했습니다.'}
                                <br/>관리자 승인 후 예약이 자동으로 확정됩니다.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="mt-4">
                            <Button className="w-full" onClick={() => {
                                if (confirmationDialogData) {
                                    updateDepositStatus(confirmationDialogData.ids, confirmationDialogData.checked);
                                }
                                setConfirmationDialogData(null);
                            }}>확인</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <AlertDialog open={!!pendingCampaign} onOpenChange={() => setPendingCampaign(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>옵션 미입력 확인</AlertDialogTitle><AlertDialogDescription>옵션이 입력되지 않았습니다. 이대로 견적에 추가하시겠습니까?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={handleConfirmAddCampaign}>추가</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                
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