// src/App.jsx (전체 코드)

import { Routes, Route, Navigate } from 'react-router-dom';

// 일반 사용자 페이지
import ReviewerLogin from './pages/ReviewerLogin';
import WriteReview from './pages/WriteReview';
import MyReviews from './pages/MyReviews';
import ReviewDetail from './pages/ReviewDetail'; // 이 컴포넌트는 현재 사용되지 않는 것 같습니다.

// 관리자 페이지
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout'; // 레이아웃 import
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
// import AdminLinkManagement from './pages/AdminLinkManagement';
// import AdminSettlement from './pages/AdminSettlement';
// import AdminSettlementComplete from './pages/AdminSettlementComplete';

// 임시 컴포넌트 (파일을 따로 만들지 않을 경우)
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

      {/* AdminLayout을 부모로 하는 중첩 라우트 */}
      <Route path="/admin" element={<AdminLayout />}>
        {/* /admin 접속 시 기본으로 보여줄 페이지 */}
        <Route index element={<Navigate to="/admin/members" replace />} /> 
        <Route path="members" element={<AdminMemberManagement />} />
        <Route path="links" element={<AdminLinkManagement />} />
        <Route path="reviews" element={<AdminReviewManagement />} />
        <Route path="settlement" element={<AdminSettlement />} />
        <Route path="settlement-complete" element={<AdminSettlementComplete />} />
      </Route>

      {/* 이전 관리자 경로들은 삭제하거나 리다이렉트 처리 */}
      {/* <Route path="/admin/reviews" element={<AdminReviewList />} /> */}
      {/* <Route path="/admin/review-management" element={<AdminReviewManagement />} /> */}
      
      {/* 정의되지 않은 모든 경로는 홈으로 */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;