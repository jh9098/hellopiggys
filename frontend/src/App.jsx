// src/App.jsx (실제 파일 구조에 100% 맞춘 최종 완성본)

import { Routes, Route, Navigate } from 'react-router-dom';

// --- 레이아웃 컴포넌트 ---
import AdminLayout from './layouts/AdminLayout';
import SellerLayout from './layouts/SellerLayout';

// --- 인증 및 공용 페이지 ---
import PrivateRoute from './pages/PrivateRoute';
import AdminLogin from './pages/AdminLogin';
import SellerLoginPage from './pages/auth/SellerLogin';
import SellerSignupPage from './pages/auth/SellerSignup';
import PaymentPage from './pages/dashboard/PaymentPage';

// --- 1. 리뷰어 관련 페이지 ---
import ReviewerLogin from './pages/ReviewerLogin';
import MyReviews from './pages/MyReviews';
import WriteReview from './pages/WriteReview';

// --- 2. 기존 리뷰어 관리자 페이지들 (pages/ 바로 아래에 위치) ---
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import AdminProductManagement from './pages/AdminProductManagement';
import AdminProductForm from './pages/AdminProductForm';
import AdminSettlement from './pages/AdminSettlement';
import AdminSettlementComplete from './pages/AdminSettlementComplete';

// --- 3. 신규 판매자 관리자 페이지들 (pages/admin/ 에 위치) ---
import SellerAdminDashboardPage from './pages/admin/SellerAdminDashboard';
import SellerAdminProductManagementPage from './pages/admin/SellerAdminProductManagement';
import SellerAdminProgressPage from './pages/admin/SellerAdminProgress';
import SellerAdminSchedulePage from './pages/admin/SellerAdminSchedule';
import SellerAdminSellerManagementPage from './pages/admin/SellerAdminSellerManagement';

// --- 4. 신규 판매자 페이지들 (pages/seller/ 에 위치) ---
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
      
      {/* ───── 3. 인증이 필요한 페이지 그룹 ───── */}
      <Route element={<PrivateRoute />}>
        
        <Route path="/dashboard/payment" element={<PaymentPage />} />

        {/* --- 관리자 페이지 그룹 --- */}
        <Route path="/admin" element={<AdminLayout />}>
          {/* URL을 보고 어떤 관리자 페이지를 보여줄지 결정 */}
          <Route index element={<Navigate to="/admin/reviewer/reviews" replace />} /> 
          
          {/* 기존 리뷰어 관리자 */}
          <Route path="reviewer/reviews" element={<AdminReviewManagement />} />
          <Route path="reviewer/members" element={<AdminMemberManagement />} />
          <Route path="reviewer/products" element={<AdminProductManagement />} />
          <Route path="reviewer/products/new" element={<AdminProductForm />} />
          <Route path="reviewer/products/edit/:productId" element={<AdminProductForm />} />
          <Route path="reviewer/settlement" element={<AdminSettlement />} />
          <Route path="reviewer/settlement-complete" element={<AdminSettlementComplete />} />
          
          {/* 신규 판매자 관리자 */}
          <Route path="selleradmin/dashboard" element={<SellerAdminDashboardPage />} />
          <Route path="selleradmin/products" element={<SellerAdminProductManagementPage />} />
          <Route path="selleradmin/progress" element={<SellerAdminProgressPage />} />
          <Route path="selleradmin/schedule" element={<SellerAdminSchedulePage />} />
          <Route path="selleradmin/sellers" element={<SellerAdminSellerManagementPage />} />
        </Route>

        {/* --- 판매자 페이지 그룹 --- */}
        <Route path="/seller" element={<SellerLayout />}>
          <Route index element={<Navigate to="/seller/dashboard" replace />} /> 
          <Route path="dashboard" element={<SellerDashboardPage />} />
          <Route path="reservation" element={<SellerReservationPage />} />
          <Route path="progress" element={<SellerProgressPage />} />
          <Route path="traffic" element={<SellerTrafficPage />} />
          <Route path="keyword" element={<SellerKeywordPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;