// src/App.jsx (수정된 전체 코드)

import { Routes, Route, Navigate } from 'react-router-dom';

// 일반 사용자 페이지
import ReviewerLogin from './pages/ReviewerLogin';
import MyReviews from './pages/MyReviews';
import DynamicWriteReview from './pages/DynamicWriteReview'; // WriteReview 대체

// 관리자 페이지
import AdminLogin from './pages/AdminLogin';
import AdminLayout from './pages/AdminLayout';
import PrivateRoute from './pages/PrivateRoute';
import AdminReviewManagement from './pages/AdminReviewManagement';
import AdminMemberManagement from './pages/AdminMemberManagement';
import AdminLinkManagement from './pages/AdminLinkManagement'; // 링크 관리 import
import AdminGenerateLink from './pages/AdminGenerateLink'; // 링크 생성 import

// 임시 컴포넌트
const AdminSettlement = () => <h2>정산내역 (준비 중)</h2>;
const AdminSettlementComplete = () => <h2>정산완료 (준비 중)</h2>;

// 잘못된 링크로 접근 시 보여줄 페이지
const InvalidLinkPage = () => <p style={{textAlign: 'center', padding: '50px'}}>잘못된 접근입니다. 제공된 링크를 통해 접속해주세요.</p>

function App() {
  return (
    <Routes>
      {/* ───── 일반 사용자 라우트 ───── */}
      <Route path="/" element={<Navigate to="/write-review" />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/my-reviews" element={<MyReviews />} />

      {/* 동적 리뷰 작성 페이지 라우트 */}
      <Route path="/link/:linkId" element={<DynamicWriteReview />} />
      {/* 기존 /write-review 경로는 잘못된 접근으로 처리 */}
      <Route path="/write-review" element={<InvalidLinkPage />} />
      
      {/* ───── 관리자 라우트 ───── */}
      <Route path="/admin-login" element={<AdminLogin />} />

      <Route element={<PrivateRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/members" replace />} /> 
          <Route path="members" element={<AdminMemberManagement />} />
          <Route path="links" element={<AdminLinkManagement />} />
          <Route path="links/new" element={<AdminGenerateLink />} /> {/* 링크 생성 페이지 */}
          <Route path="reviews" element={<AdminReviewManagement />} />
          <Route path="settlement" element={<AdminSettlement />} />
          <Route path="settlement-complete" element={<AdminSettlementComplete />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;