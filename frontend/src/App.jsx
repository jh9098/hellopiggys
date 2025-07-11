// src/App.jsx (모든 페이지 라우팅이 포함된 최종 완성본)

import { Routes, Route, Navigate } from 'react-router-dom';

// --- 레이아웃 컴포넌트 ---
import AdminLayout from './layouts/AdminLayout';
import SellerLayout from './layouts/SellerLayout';

// --- 인증 및 공용 페이지 ---
import PrivateRoute from './pages/PrivateRoute'; // HOC 대신 사용하는 인증 보호 라우트
import ReviewerLogin from './pages/ReviewerLogin';
import AdminLogin from './pages/AdminLogin';
import SellerLoginPage from './pages/auth/SellerLogin';     // 판매자 로그인
import SellerSignupPage from './pages/auth/SellerSignup';   // 판매자 회원가입
import PaymentPage from './pages/dashboard/PaymentPage';      // 결제 페이지

// --- 리뷰어(일반 사용자) 페이지 ---
import MyReviews from './pages/MyReviews';
import WriteReview from './pages/WriteReview';

// --- 관리자 페이지 ---
import AdminDashboardPage from './pages/admin/AdminDashboard';
import AdminCampaignManagementPage from './pages/admin/AdminCampaignManagement';
import AdminProgressPage from './pages/admin/AdminProgress';
import AdminSchedulePage from './pages/admin/AdminSchedule';
import AdminSellerManagementPage from './pages/admin/AdminSellerManagement';
// 기존 hellopiggy 관리자 페이지들 (필요시 주석 해제 또는 이름 변경하여 사용)
// import AdminReviewManagement from './pages/AdminReviewManagement';
// import AdminMemberManagement from './pages/AdminMemberManagement';
// import AdminProductManagement from './pages/AdminProductManagement';

// --- 판매자 페이지 ---
import SellerDashboardPage from './pages/seller/SellerDashboard'; 
import SellerReservationPage from './pages/seller/SellerReservation';
import SellerProgressPage from './pages/seller/SellerProgress';
import SellerTrafficPage from './pages/seller/SellerTraffic';
import SellerKeywordPage from './pages/seller/SellerKeyword';

const InvalidAccessPage = () => <p style={{textAlign: 'center', padding: '50px'}}>잘못된 접근입니다.</p>;

function App() {
  return (
    <Routes>
      {/* ───── 1. 공용 및 인증 라우트 (누구나 접근 가능) ───── */}
      <Route path="/" element={<Navigate to="/link" replace />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/seller-login" element={<SellerLoginPage />} />
      <Route path="/seller-signup" element={<SellerSignupPage />} />
      
      {/* ───── 2. 리뷰어 관련 라우트 ───── */}
      <Route path="/my-reviews" element={<MyReviews />} />
      <Route path="/link" element={<WriteReview />} />
      
      {/* ───── 3. 인증이 필요한 페이지 그룹 (관리자, 판매자 등) ───── */}
      <Route element={<PrivateRoute />}>
        
        {/* 결제 페이지 */}
        <Route path="/dashboard/payment" element={<PaymentPage />} />

        {/* --- 관리자 페이지 그룹 --- */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} /> 
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="campaigns" element={<AdminCampaignManagementPage />} />
          <Route path="progress" element={<AdminProgressPage />} />
          <Route path="schedule" element={<AdminSchedulePage />} />
          <Route path="sellers" element={<AdminSellerManagementPage />} />
          
          {/* 기존 hellopiggy 관리자 기능이 필요하면 아래 주석을 해제하세요. */}
          {/* <Route path="reviews" element={<AdminReviewManagement />} /> */}
          {/* <Route path="members" element={<AdminMemberManagement />} /> */}
          {/* <Route path="products" element={<AdminProductManagement />} /> */}
          
          <Route path="*" element={<InvalidAccessPage />} />
        </Route>

        {/* --- 판매자 페이지 그룹 --- */}
        <Route path="/seller" element={<SellerLayout />}>
          <Route index element={<Navigate to="/seller/dashboard" replace />} /> 
          <Route path="dashboard" element={<SellerDashboardPage />} />
          <Route path="reservation" element={<SellerReservationPage />} />
          <Route path="progress" element={<SellerProgressPage />} />
          <Route path="traffic" element={<SellerTrafficPage />} />
          <Route path="keyword" element={<SellerKeywordPage />} />
          
          <Route path="*" element={<InvalidAccessPage />} />
        </Route>
      </Route>
      
      {/* ───── 4. 그 외 모든 일치하지 않는 경로는 홈으로 ───── */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;