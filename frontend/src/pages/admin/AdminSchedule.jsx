// src/pages/admin/AdminSchedule.jsx

import { useEffect, useState, useMemo, useCallback } from 'react';
import { db, collection, onSnapshot, doc, setDoc } from '../../firebaseConfig';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from "@fullcalendar/interaction";

const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const CapacityInput = ({ dateStr, initialValue }) => {
    const [value, setValue] = useState(initialValue);
    const updateFirestore = useCallback(async (numericValue) => {
        try { await setDoc(doc(db, 'capacities', dateStr), { capacity: numericValue }); } 
        catch (error) { console.error("Capacity 업데이트 오류:", error); }
    }, [dateStr]);
    const handleChange = (e) => { setValue(e.target.value); };
    const handleBlur = () => {
        const numericValue = Number(String(value).replace(/[^0-9]/g, '')) || 0;
        setValue(numericValue);
        updateFirestore(numericValue);
    };
    useEffect(() => { setValue(initialValue); }, [initialValue]);
    return <input type="number" value={value} onChange={handleChange} onBlur={handleBlur} onClick={(e) => e.stopPropagation()} className="w-full text-center border rounded-sm p-0.5" placeholder="총량" />;
};

export default function AdminSchedulePage() {
    const [campaigns, setCampaigns] = useState([]);
    const [sellers, setSellers] = useState({});
    const [capacities, setCapacities] = useState({});
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        const unsubSellers = onSnapshot(collection(db, 'sellers'), (snap) => {
            const map = {}; snap.forEach(doc => { const d = doc.data(); if(d.uid) map[d.uid] = d.nickname || '이름없음'; });
            setSellers(map);
        });
        const unsubCampaigns = onSnapshot(collection(db, 'campaigns'), (snap) => setCampaigns(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubCapacities = onSnapshot(collection(db, 'capacities'), (snap) => {
            const map = {}; snap.forEach(doc => { map[doc.id] = doc.data().capacity || 0; });
            setCapacities(map);
        });
        return () => { unsubSellers(); unsubCampaigns(); unsubCapacities(); };
    }, []);
    
    const events = useMemo(() => {
        if (Object.keys(sellers).length === 0) return [];
        return campaigns.map(campaign => {
            const sellerName = sellers[campaign.sellerUid] || '판매자 없음';
            const eventDate = campaign.date?.seconds ? new Date(campaign.date.seconds * 1000) : new Date(campaign.date);
            return { id: campaign.id, title: `${sellerName} (${campaign.quantity || 0}개)`, start: eventDate, allDay: true, extendedProps: { quantity: campaign.quantity || 0 } };
        });
    }, [campaigns, sellers]);

    const handleDatesSet = (dateInfo) => setCurrentMonth(dateInfo.view.currentStart);

    const currentMonthDates = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const dates = [];
        for (let i = 1; i <= daysInMonth; i++) {
            dates.push(formatDate(new Date(year, month, i)));
        }
        return dates;
    }, [currentMonth]);

    const renderDayCell = (dayCellInfo) => {
        const dateStr = formatDate(dayCellInfo.date);
        const capacity = capacities[dateStr] || 0;
        const dailyEvents = events.filter(event => formatDate(new Date(event.start)) === dateStr);
        const totalQuantity = dailyEvents.reduce((sum, event) => sum + Number(event.extendedProps?.quantity || 0), 0);
        const remaining = capacity - totalQuantity;
        const remainingColor = remaining >= 0 ? 'text-blue-600' : 'text-red-600';

        return (
            <div className="p-1 text-center">
                <div className="fc-daygrid-day-number">{dayCellInfo.dayNumberText.replace('일', '')}</div>
                <div className="text-xs text-gray-500 mt-1">잔여</div>
                <div className={`text-lg font-bold ${remainingColor}`}>{remaining}</div>
            </div>
        );
    };

    return (
        <>
            <h2 className="text-2xl font-bold mb-4">예약 시트 관리 (월간)</h2>
            <div className="bg-white p-4 rounded-lg shadow-md mb-8">
                <FullCalendar plugins={[dayGridPlugin, interactionPlugin]} initialView="dayGridMonth" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }} events={events} dayCellContent={renderDayCell} datesSet={handleDatesSet} locale="ko" height="auto" timeZone='local' buttonText={{ today: '오늘', month: '월', week: '주' }} />
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-bold mb-4">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월 작업 가능 개수 설정</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {currentMonthDates.map(dateStr => (
                        <div key={dateStr} className="p-3 border rounded-lg">
                            <label className="block text-sm font-semibold text-gray-700">{dateStr}</label>
                            <CapacityInput dateStr={dateStr} initialValue={capacities[dateStr] || ''} />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}