// src/App.jsx (단일 관리자 페이지 구조 최종본)

import { Routes, Route, Navigate } from 'react-router-dom';

// --- 레이아웃 컴포넌트 ---
import AdminLayout from './pages/AdminLayout'; // [수정] pages 폴더의 레이아웃 사용
import SellerLayout from './layouts/SellerLayout';
import ReviewerLayout from './layouts/ReviewerLayout';

// --- 인증 및 공용 페이지 ---
import PrivateRoute from './pages/PrivateRoute';
import AdminLogin from './pages/AdminLogin';
import SellerLoginPage from './pages/auth/SellerLogin';
import SellerSignupPage from './pages/auth/SellerSignup';
import PaymentPage from './pages/dashboard/PaymentPage';

// --- 리뷰어 관련 페이지 ---
import ReviewerLogin from './pages/ReviewerLogin';
import MyReviews from './pages/MyReviews';
import WriteReview from './pages/WriteReview';
import KakaoCallback from './pages/KakaoCallback';
import PrivacyPolicy from './pages/PrivacyPolicy';

// --- [기존] 리뷰어 관리자 페이지들 ---
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import AdminProductManagement from './pages/AdminProductManagement';
import AdminProductForm from './pages/AdminProductForm';
import AdminSettlement from './pages/AdminSettlement';
import AdminSettlementComplete from './pages/AdminSettlementComplete';

// --- [신규] 판매자 관리자 페이지들 ---
import SellerAdminDashboardPage from './pages/admin/SellerAdminDashboard';
import SellerAdminProductManagementPage from './pages/admin/SellerAdminProductManagement';
import SellerAdminProgressPage from './pages/admin/SellerAdminProgress';
import SellerAdminSchedulePage from './pages/admin/SellerAdminSchedule';
import SellerAdminSellerManagementPage from './pages/admin/SellerAdminSellerManagement';
import SellerAdminTrafficPage from './pages/admin/SellerAdminTraffic';

// --- 판매자 페이지들 ---
import SellerDashboardPage from './pages/seller/SellerDashboard'; 
import SellerReservationPage from './pages/seller/SellerReservation';
import SellerProgressPage from './pages/seller/SellerProgress';
import SellerTrafficPage from './pages/seller/SellerTraffic';
import SellerKeywordPage from './pages/seller/SellerKeyword';

function App() {
  return (
    <Routes>
      {/* ───── 1. 공용 라우트 ───── */}
      <Route path="/" element={<Navigate to="/reviewer/link" replace />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/seller-login" element={<SellerLoginPage />} />
      <Route path="/seller-signup" element={<SellerSignupPage />} />
      <Route path="/link" element={<Navigate to="/reviewer/link" replace />} />
      <Route path="/my-reviews" element={<Navigate to="/reviewer/my-reviews" replace />} />
      <Route path="/kakao-callback" element={<KakaoCallback />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      
      {/* ───── 2. 인증이 필요한 페이지 그룹 ───── */}
      <Route element={<PrivateRoute />}>
        {/* 리뷰어 */}
        <Route path="/reviewer" element={<ReviewerLayout />}>
          <Route index element={<Navigate to="link" replace />} />
          <Route path="link" element={<WriteReview />} />
          <Route path="my-reviews" element={<MyReviews />} />
        </Route>

        {/* 판매자 */}
        <Route path="/seller" element={<SellerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} /> 
          <Route path="dashboard" element={<SellerDashboardPage />} />
          <Route path="reservation" element={<SellerReservationPage />} />
          <Route path="progress" element={<SellerProgressPage />} />
          <Route path="traffic" element={<SellerTrafficPage />} />
          <Route path="keyword" element={<SellerKeywordPage />} />
        </Route>
        <Route path="/dashboard/payment" element={<PaymentPage />} />

        {/* 관리자 (통합) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="reviews" replace />} /> 
          {/* 기존 리뷰어 관리 */}
          <Route path="reviews" element={<AdminReviewManagement />} />
          <Route path="members" element={<AdminMemberManagement />} />
          <Route path="products" element={<AdminProductManagement />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/edit/:productId" element={<AdminProductForm />} />
          <Route path="settlement" element={<AdminSettlement />} />
          <Route path="settlement-complete" element={<AdminSettlementComplete />} />
          {/* 신규 판매자/캠페인 관리 */}
          <Route path="seller-dashboard" element={<SellerAdminDashboardPage />} />
          <Route path="seller-products" element={<SellerAdminProductManagementPage />} />
          <Route path="seller-list" element={<SellerAdminSellerManagementPage />} />
          <Route path="seller-schedule" element={<SellerAdminSchedulePage />} />
          <Route path="seller-progress" element={<SellerAdminProgressPage />} />
          <Route path="seller-traffic" element={<SellerAdminTrafficPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;