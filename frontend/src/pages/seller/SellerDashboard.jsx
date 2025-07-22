// src/pages/seller/SellerDashboard.jsx (shadcn/ui 리팩토링 버전)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, onSnapshot } from '../../firebaseConfig';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";
import { format } from 'date-fns';

// --- shadcn/ui 컴포넌트 임포트 ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from '@/lib/utils';

const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '';
    return format(date, "yyyy-MM-dd");
};

export default function SellerDashboardPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({});
    const [capacities, setCapacities] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribes = [];
        
        const sellerUnsubscribe = onSnapshot(collection(db, 'sellers'), (snap) => {
            const fetchedSellers = {};
            snap.forEach(doc => {
                const data = doc.data();
                if (data.uid) fetchedSellers[data.uid] = data.nickname || '이름없음';
            });
            setSellers(fetchedSellers);
        });
        unsubscribes.push(sellerUnsubscribe);

        const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
            setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        unsubscribes.push(campaignUnsubscribe);
        
        const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
            const fetchedCaps = {};
            snap.forEach(doc => { fetchedCaps[doc.id] = doc.data().capacity || 0; });
            setCapacities(fetchedCaps);
            setIsLoading(false); // 마지막 데이터 로딩 후 로딩 상태 변경
        });
        unsubscribes.push(capacityUnsubscribe);

        return () => unsubscribes.forEach(unsub => unsub());
    }, []);

    const events = useMemo(() => {
        if (Object.keys(sellers).length === 0 || campaigns.length === 0) return [];

        const confirmed = campaigns.filter(c => c.status === '예약 확정');
        const dailyAggregates = {};

        confirmed.forEach(campaign => {
            const eventDate = campaign.date?.seconds ? new Date(campaign.date.seconds * 1000) : new Date(campaign.date);
            const dateStr = formatDate(eventDate);
            if (!dateStr) return;
            const nickname = sellers[campaign.sellerUid] || '판매자 없음';
            const quantity = Number(campaign.quantity) || 0;
            if (!dailyAggregates[dateStr]) dailyAggregates[dateStr] = {};
            if (!dailyAggregates[dateStr][nickname]) dailyAggregates[dateStr][nickname] = 0;
            dailyAggregates[dateStr][nickname] += quantity;
        });

        const aggregatedEvents = [];
        for (const dateStr in dailyAggregates) {
            for (const nickname in dailyAggregates[dateStr]) {
                const totalQuantity = dailyAggregates[dateStr][nickname];
                if (totalQuantity > 0) {
                    aggregatedEvents.push({
                        id: `${dateStr}-${nickname}`, 
                        title: `${nickname} (${totalQuantity}개)`,
                        start: dateStr, 
                        allDay: true, 
                        extendedProps: { quantity: totalQuantity },
                        // shadcn/ui 스타일에 맞게 이벤트 색상 변경
                        className: 'bg-primary text-primary-foreground border-primary'
                    });
                }
            }
        }
        return aggregatedEvents;
    }, [campaigns, sellers]);
  
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        const dailyEvents = events.filter(event => formatDate(new Date(event.start)) === dateStr);
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.extendedProps?.quantity || 0), 0);
        const remaining = capacity - totalQuantity;
        const isReservable = remaining > 0 && capacity > 0;
        const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-destructive';

        return (
            <div className="flex flex-col h-full p-1">
                <div className="text-right text-xs text-muted-foreground">{dayCellInfo.dayNumberText}</div>
                <div className="flex flex-col items-center justify-center flex-grow">
                    <div className="text-[10px] text-muted-foreground">잔여</div>
                    {isReservable ? (
                        <Link 
                            to={`/seller/reservation?date=${dateStr}`}
                            className={cn(buttonVariants({ variant: "link", size: "sm" }), "h-auto p-0 text-lg font-bold", remainingColor)}
                        >
                            {remaining}
                        </Link>
                    ) : (
                        <span className={`text-lg font-bold ${remainingColor}`}>{remaining}</span>
                    )}
                </div>
            </div>
        );
    };
    
    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><p>캘린더 데이터를 불러오는 중...</p></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>체험단 예약 현황</CardTitle>
                <CardDescription>잔여 수량을 클릭하여 해당 날짜로 바로 예약할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                    buttonText={{ today: '오늘' }}
                    events={events}
                    dayCellContent={renderSellerDayCell}
                    dayCellClassNames="h-32" 
                    locale="ko"
                    height="auto"
                    timeZone='local'
                    eventDisplay="list-item"
                />
            </CardContent>
        </Card>
    );
}