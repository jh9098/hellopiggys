// src/pages/seller/SellerDashboard.jsx (레이아웃 수정 및 UI 개선 최종본)

import { useEffect, useState, useMemo } from 'react';
import { db, collection, onSnapshot } from '../../firebaseConfig';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";
import SellerLayout from '../../layouts/SellerLayout';

const formatDate = (date) => {
    if (!date || !(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function SellerDashboardPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({});
    const [capacities, setCapacities] = useState({});

    useEffect(() => {
        const sellerUnsubscribe = onSnapshot(collection(db, 'sellers'), (snap) => {
            const fetchedSellers = {};
            snap.forEach(doc => {
                const data = doc.data();
                if (data.uid) {
                    fetchedSellers[data.uid] = data.nickname || '이름없음';
                }
            });
            setSellers(fetchedSellers);
        });

        const campaignUnsubscribe = onSnapshot(collection(db, 'campaigns'), (snap) => {
            const fetchedCampaigns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setCampaigns(fetchedCampaigns);
        });
        
        const capacityUnsubscribe = onSnapshot(collection(db, 'capacities'), (snap) => {
            const fetchedCaps = {};
            snap.forEach(doc => { 
                fetchedCaps[doc.id] = doc.data().capacity || 0; 
            });
            setCapacities(fetchedCaps);
        });

        return () => { 
            sellerUnsubscribe();
            campaignUnsubscribe(); 
            capacityUnsubscribe(); 
        };
    }, []);

    const events = useMemo(() => {
        if (Object.keys(sellers).length === 0 || campaigns.length === 0) return [];

        const confirmed = campaigns.filter(c => c.status === '예약 확정');
        const dailyAggregates = {};

        confirmed.forEach(campaign => {
            const eventDate = campaign.date?.seconds
                ? new Date(campaign.date.seconds * 1000)
                : new Date(campaign.date);
            
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
            const nicknamesForDay = dailyAggregates[dateStr];
            for (const nickname in nicknamesForDay) {
                const totalQuantity = nicknamesForDay[nickname];
                if (totalQuantity > 0) {
                    aggregatedEvents.push({
                        id: `${dateStr}-${nickname}`,
                        title: `${nickname} (${totalQuantity}개)`,
                        start: dateStr,
                        allDay: true,
                        extendedProps: { quantity: totalQuantity }
                    });
                }
            }
        }
        
        return aggregatedEvents;
    }, [campaigns, sellers]);
  
    const renderSellerDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        
        const dailyEvents = events.filter(event => 
            formatDate(new Date(event.start)) === dateStr
        );
        
        const totalQuantity = dailyEvents.reduce((sum, event) => {
            return sum + Number(event.extendedProps?.quantity || 0);
        }, 0);
        
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining > 0 ? 'text-blue-600' : 'text-red-500';
        const remainingTextSize = 'text-xl'; 

        return (
            <div className="flex flex-col h-full">
                <div className="text-right text-sm text-gray-500 pr-1 pt-1">
                    {dayCellInfo.dayNumberText}일
                </div>
                <div className="flex flex-col items-center justify-center flex-grow pb-2">
                    <div className="text-xs text-gray-500">잔여</div>
                    {remaining > 0 && capacity > 0 ? (
                        <Link to={`/seller/reservation?date=${dateStr}`}>
                            <span className={`font-bold ${remainingTextSize} ${remainingColor} cursor-pointer hover:underline`}>
                                {remaining}
                            </span>
                        </Link>
                    ) : (
                        <span className={`font-bold ${remainingTextSize} ${remainingColor}`}>{remaining}</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <SellerLayout>
        <>
            <h2 className="text-2xl font-bold mb-4">체험단 예약 현황 (잔여 수량 클릭 시 예약 가능)</h2>
            <div className="bg-white p-4 rounded-lg shadow-md">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
                    buttonText={{ today: '오늘' }}
                    events={events}
                    dayCellContent={renderSellerDayCell}
                    dayCellClassNames="relative h-28" 
                    locale="ko"
                    height="auto"
                    timeZone='local'
                    eventDisplay="list-item" 
                    eventColor="#374151" 
                />
            </div>
        </>
        </SellerLayout>
    );
}