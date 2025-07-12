// src/App.jsx (기존 리뷰어 + 신규 판매자 기능 완벽 통합 최종본)

import { Routes, Route, Navigate } from 'react-router-dom';

// --- 레이아웃 컴포넌트 ---
import AdminLayout from './layouts/AdminLayout'; // hellopiggy 관리자 레이아웃
import SellerLayout from './layouts/SellerLayout'; // revseller 판매자 레이아웃

// --- 인증 및 공용 페이지 ---
import PrivateRoute from './pages/PrivateRoute';
import ReviewerLogin from './pages/ReviewerLogin';
import AdminLogin from './pages/AdminLogin';
import SellerLoginPage from './pages/auth/SellerLogin';
import SellerSignupPage from './pages/auth/SellerSignup';
import PaymentPage from './pages/dashboard/PaymentPage';

// --- 1. 기존 리뷰어(hellopiggy) 페이지들 ---
import MyReviews from './pages/MyReviews';
import WriteReview from './pages/WriteReview';

// --- 2. 기존 리뷰어(hellopiggy) 관리자 페이지들 ---
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import AdminProductManagement from './pages/AdminProductManagement';
import AdminProductForm from './pages/AdminProductForm';
import AdminSettlement from './pages/AdminSettlement';
import AdminSettlementComplete from './pages/AdminSettlementComplete';

// --- 3. 신규 판매자(revseller) 관리자 페이지들 ---
import SellerAdminDashboard from './pages/admin/AdminDashboard'; // 이름 충돌 방지를 위해 SellerAdmin... 으로 명명
import SellerAdminProducts from './pages/admin/AdminProductManagement';
import SellerAdminProgress from './pages/admin/AdminProgress';
import SellerAdminSchedule from './pages/admin/AdminSchedule';
import SellerAdminSellers from './pages/admin/AdminSellerManagement';

// --- 4. 신규 판매자(revseller) 페이지들 ---
import SellerDashboard from './pages/seller/SellerDashboard'; 
import SellerReservation from './pages/seller/SellerReservation';
import SellerProgress from './pages/seller/SellerProgress';
import SellerTraffic from './pages/seller/SellerTraffic';
import SellerKeyword from './pages/seller/SellerKeyword';

const InvalidAccessPage = () => <p style={{textAlign: 'center', padding: '50px'}}>잘못된 접근입니다.</p>;

function App() {
  return (
    <Routes>
      {/* ───── 1. 공용 및 인증 라우트 ───── */}
      <Route path="/" element={<Navigate to="/link" replace />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/seller-login" element={<SellerLoginPage />} />
      <Route path="/seller-signup" element={<SellerSignupPage />} />
      
      {/* ───── 2. 리뷰어 관련 라우트 ───── */}
      <Route path="/my-reviews" element={<MyReviews />} />
      <Route path="/link" element={<WriteReview />} />
      <Route path="/link/:linkId" element={<Navigate to="/link" replace />} />
      
      {/* ───── 3. 인증이 필요한 페이지 그룹 (관리자, 판매자 등) ───── */}
      <Route element={<PrivateRoute />}>
        
        {/* 결제 페이지 */}
        <Route path="/dashboard/payment" element={<PaymentPage />} />

        {/* --- [기존] 리뷰어 관리자 페이지 그룹 --- */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/reviews" replace />} /> 
          <Route path="members" element={<AdminMemberManagement />} />
          <Route path="reviews" element={<AdminReviewManagement />} />
          <Route path="products" element={<AdminProductManagement />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/edit/:productId" element={<AdminProductForm />} />
          <Route path="settlement" element={<AdminSettlement />} />
          <Route path="settlement-complete" element={<AdminSettlementComplete />} />
        </Route>

        {/* --- [신규] 판매자 관리자 페이지 그룹 --- */}
        {/* URL 충돌을 피하기 위해 /admin/selleradmin 과 같이 하위 경로로 배치 */}
        <Route path="/admin/selleradmin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/selleradmin/dashboard" replace />} /> 
          <Route path="dashboard" element={<SellerAdminDashboard />} />
          <Route path="products" element={<SellerAdminProducts />} />
          <Route path="progress" element={<SellerAdminProgress />} />
          <Route path="schedule" element={<SellerAdminSchedule />} />
          <Route path="sellers" element={<SellerAdminSellers />} />
        </Route>

        {/* --- [신규] 판매자 페이지 그룹 --- */}
        <Route path="/seller" element={<SellerLayout />}>
          <Route index element={<Navigate to="/seller/dashboard" replace />} /> 
          <Route path="dashboard" element={<SellerDashboard />} />
          <Route path="reservation" element={<SellerReservation />} />
          <Route path="progress" element={<SellerProgress />} />
          <Route path="traffic" element={<SellerTrafficPage />} />
          <Route path="keyword" element={<SellerKeywordPage />} />
        </Route>

      </Route>
      
      {/* ───── 4. 그 외 모든 일치하지 않는 경로는 홈으로 ───── */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;