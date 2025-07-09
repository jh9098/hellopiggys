// src/App.jsx (라우터 설정을 명확하게 수정)

import { Routes, Route, Navigate } from 'react-router-dom';

// 일반 사용자 페이지
import ReviewerLogin from './pages/ReviewerLogin';
import MyReviews from './pages/MyReviews';
import WriteReview from './pages/WriteReview';

// 관리자 페이지
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import PrivateRoute from './pages/PrivateRoute';
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import AdminProductManagement from './pages/AdminProductManagement';
import AdminProductForm from './pages/AdminProductForm';
import AdminSettlement from './pages/AdminSettlement';
import AdminSettlementComplete from './pages/AdminSettlementComplete';

const InvalidAccessPage = () => <p style={{textAlign: 'center', padding: '50px'}}>잘못된 접근입니다.</p>;

function App() {
  return (
    <Routes>
      {/* ───── 일반 사용자 라우트 ───── */}
      <Route path="/" element={<Navigate to="/link" />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/my-reviews" element={<MyReviews />} />
      <Route path="/link" element={<WriteReview />} />
      <Route path="/link/:linkId" element={<Navigate to="/link" replace />} />
      <Route path="/write-review" element={<Navigate to="/link" replace />} />
      
      {/* ───── 관리자 라우트 ───── */}
      <Route path="/admin-login" element={<AdminLogin />} />

      <Route element={<PrivateRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/reviews" replace />} /> 
          <Route path="members" element={<AdminMemberManagement />} />
          <Route path="reviews" element={<AdminReviewManagement />} />
          
          {/* ▼▼▼ 이 부분이 가장 중요합니다. ▼▼▼ */}
          {/* '/admin/products'는 상품 "목록" 컴포넌트를 렌더링합니다. */}
          <Route path="products" element={<AdminProductManagement />} />
          
          {/* '/admin/products/new'는 상품 "생성 폼" 컴포넌트를 렌더링합니다. */}
          <Route path="products/new" element={<AdminProductForm />} />
          
          {/* '/admin/products/edit/:productId'는 상품 "수정 폼" 컴포넌트를 렌더링합니다. */}
          <Route path="products/edit/:productId" element={<AdminProductForm />} />
          {/* ▲▲▲ 이 부분을 다시 한번 확인해주세요. ▲▲▲ */}

          <Route path="settlement" element={<AdminSettlement />} />
          <Route path="settlement-complete" element={<AdminSettlementComplete />} />

          {/* 사용하지 않는 링크 관련 라우트는 제거하거나 비활성화 */}
          <Route path="links/*" element={<InvalidAccessPage />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;