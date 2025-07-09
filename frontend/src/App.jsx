// src/App.jsx (상품 시스템에 맞게 라우터 수정)

import { Routes, Route, Navigate } from 'react-router-dom';

// 일반 사용자 페이지
import ReviewerLogin from './pages/ReviewerLogin';
import MyReviews from './pages/MyReviews';
import WriteReview from './pages/WriteReview'; // 새로운 통합 리뷰 작성 페이지

// 관리자 페이지
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import PrivateRoute from './pages/PrivateRoute';
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import AdminProductManagement from './pages/AdminProductManagement'; // 상품 관리
import AdminProductForm from './pages/AdminProductForm';       // 상품 생성/수정
import AdminSettlement from './pages/AdminSettlement';
import AdminSettlementComplete from './pages/AdminSettlementComplete';

// 잘못된 링크로 접근 시 보여줄 페이지
const InvalidAccessPage = () => <p style={{textAlign: 'center', padding: '50px'}}>잘못된 접근입니다.</p>;

function App() {
  return (
    <Routes>
      {/* ───── 일반 사용자 라우트 ───── */}
      <Route path="/" element={<Navigate to="/link" />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/my-reviews" element={<MyReviews />} />

      {/* 새로운 통합 리뷰 작성 페이지 라우트 */}
      <Route path="/link" element={<WriteReview />} />

      {/* 기존 동적 링크는 더 이상 사용하지 않음 */}
      <Route path="/link/:linkId" element={<Navigate to="/link" replace />} />
      <Route path="/write-review" element={<Navigate to="/link" replace />} />
      
      {/* ───── 관리자 라우트 ───── */}
      <Route path="/admin-login" element={<AdminLogin />} />

      <Route element={<PrivateRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/reviews" replace />} /> 
          <Route path="members" element={<AdminMemberManagement />} />
          <Route path="reviews" element={<AdminReviewManagement />} />
          
          {/* 상품 관리 라우트 */}
          <Route path="products" element={<AdminProductManagement />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/edit/:productId" element={<AdminProductForm />} />

          <Route path="settlement" element={<AdminSettlement />} />
          <Route path="settlement-complete" element={<AdminSettlementComplete />} />

          {/* 기존 링크 관련 라우트는 삭제 */}
          <Route path="links/*" element={<InvalidAccessPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;