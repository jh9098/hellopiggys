// src/App.jsx (수정된 전체 코드)

import { Routes, Route, Navigate } from 'react-router-dom';

// 일반 사용자 페이지
import ReviewerLogin from './pages/ReviewerLogin';
import WriteReview from './pages/WriteReview';
import MyReviews from './pages/MyReviews';

// 관리자 페이지
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import PrivateRoute from './pages/PrivateRoute'; // PrivateRoute import

// 임시 컴포넌트
const AdminLinkManagement = () => <h2>링크 관리 (준비 중)</h2>;
const AdminSettlement = () => <h2>정산내역 (준비 중)</h2>;
const AdminSettlementComplete = () => <h2>정산완료 (준비 중)</h2>;

function App() {
  return (
    <Routes>
      {/* ───── 일반 사용자 라우트 ───── */}
      <Route path="/" element={<Navigate to="/write-review" />} />
      <Route path="/write-review" element={<WriteReview />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/my-reviews" element={<MyReviews />} />
      
      {/* ───── 관리자 라우트 ───── */}
      <Route path="/admin-login" element={<AdminLogin />} />

      {/* PrivateRoute가 인증/권한을 확인하고 통과해야만 AdminLayout과 그 자식들이 렌더링됨 */}
      <Route element={<PrivateRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/members" replace />} /> 
          <Route path="members" element={<AdminMemberManagement />} />
          <Route path="links" element={<AdminLinkManagement />} />
          <Route path="reviews" element={<AdminReviewManagement />} />
          <Route path="settlement" element={<AdminSettlement />} />
          <Route path="settlement-complete" element={<AdminSettlementComplete />} />
        </Route>
      </Route>
      
      {/* 정의되지 않은 모든 경로는 홈으로 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;