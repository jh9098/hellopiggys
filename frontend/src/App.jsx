import ReviewerLogin from './pages/ReviewerLogin';
import WriteReview from './pages/WriteReview';
import MyReviews from './pages/MyReviews';
import AdminLogin from './pages/AdminLogin';
import AdminReviewList from './pages/AdminReviewList';
import ReviewDetail from './pages/ReviewDetail';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminReviewManagement from './pages/AdminReviewManagement';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/write-review" />} />
      <Route path="/write-review" element={<WriteReview />} />
      <Route path="/reviewer-login" element={<ReviewerLogin />} />
      <Route path="/my-reviews" element={<MyReviews />} />
      <Route path="/admin-login" element={<AdminLogin />} />
      <Route path="/admin/reviews" element={<AdminReviewList />} />
      <Route path="/reviews/:id" element={<ReviewDetail />} />
      <Route path="*" element={<Navigate to="/" />} />
      <route path="/admin/review-management" element={<AdminReviewManagement />} />
    </Routes>
  );
}

export default App;
