// src/pages/dashboard/PaymentPage.jsx (Vite 환경에 맞게 수정된 최종본)

import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom'; // [수정] useSearchParams, useNavigate 임포트
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { db, auth, doc, getDoc, onAuthStateChanged } from '../../firebaseConfig'; // [수정] 경로 변경

// [주의] 이 클라이언트 키는 테스트용 키입니다. 실제 운영 시에는 발급받은 라이브 키로 교체해야 합니다.
const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

export default function PaymentPage() {
    const paymentWidgetRef = useRef(null);
    const [paymentAmount, setPaymentAmount] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState('결제 정보를 불러오는 중입니다...');
    
    const [searchParams] = useSearchParams(); // [수정] URL 쿼리 파라미터를 읽기 위한 훅
    const navigate = useNavigate(); // [수정] 페이지 이동을 위한 훅

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                // URL의 '?amount=' 쿼리 파라미터 값을 가져옵니다.
                const amountFromQuery = searchParams.get('amount');
                
                if (amountFromQuery) {
                    setPaymentAmount(Number(amountFromQuery));
                } else {
                    // 쿼리 파라미터가 없으면 Firestore에서 고정 금액을 가져옵니다.
                    const fetchSellerData = async () => {
                        const sellerDocRef = doc(db, 'sellers', user.uid);
                        const sellerDocSnap = await getDoc(sellerDocRef);
                        if (sellerDocSnap.exists()) {
                            setPaymentAmount(sellerDocSnap.data().paymentAmount || 50000);
                        } else {
                            setPaymentAmount(50000); // 기본값
                        }
                    };
                    fetchSellerData();
                }
            } else {
                setLoadingMessage('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
                setTimeout(() => navigate('/seller-login'), 2000); // 2초 후 로그인 페이지로 이동
            }
        });
        return () => unsubscribe();
    }, [searchParams, navigate]); // 의존성 배열에 searchParams, navigate 추가

    useEffect(() => {
        if (paymentAmount === null || paymentAmount <= 0) return;

        const fetchPaymentWidget = async () => {
            try {
                // window.PaymentWidget은 index.html에 추가한 스크립트를 통해 전역으로 접근 가능합니다.
                const paymentWidget = await window.PaymentWidget(clientKey, window.PaymentWidget.ANONYMOUS);
                
                paymentWidget.renderPaymentMethods(
                    '#payment-method', 
                    { value: paymentAmount },
                    { variantKey: "DEFAULT" }
                );
                
                paymentWidgetRef.current = paymentWidget;
                setLoadingMessage(''); // 로딩 완료 후 메시지 제거

            } catch (error) {
                console.error("결제 위젯 렌더링 실패:", error);
                setLoadingMessage("결제 위젯을 불러오는 데 실패했습니다. 새로고침 해주세요.");
            }
        };

        fetchPaymentWidget();
    }, [paymentAmount]); // paymentAmount가 확정되면 위젯 렌더링

    const handlePayment = async () => {
        const paymentWidget = paymentWidgetRef.current;
        if (!paymentWidget) {
            alert('결제 위젯이 로드되지 않았습니다.');
            return;
        }
        try {
            await paymentWidget.requestPayment({
                orderId: `order_${nanoid()}`,
                orderName: '리뷰 마케팅 캠페인 결제',
                customerName: auth.currentUser?.displayName || '판매자',
                // [주의] 성공/실패 URL은 실제 배포된 도메인 기준으로 정확히 작성해야 합니다.
                successUrl: `${window.location.origin}/seller/dashboard`, // 성공 시 판매자 대시보드로 이동
                failUrl: `${window.location.origin}/dashboard/payment`,
            });
        } catch (err) {
            console.error("결제 요청 에러:", err);
            alert('결제 요청에 실패했습니다.');
        }
    };

    if (loadingMessage) {
        return <div>{loadingMessage}</div>;
    }

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: 'auto' }}>
            <h1>캠페인 결제</h1>
            <div id="payment-method" />
            <Button
                onClick={handlePayment}
                style={{ marginTop: '20px', padding: '10px 20px', width: '100%', fontSize: '1.2rem' }}
            >
                {paymentAmount.toLocaleString()}원 결제하기
            </Button>
        </div>
    );
}