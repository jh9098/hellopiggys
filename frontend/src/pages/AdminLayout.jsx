// src/pages/AdminLayout.jsx (기존 CSS 스타일로 완전 복원)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth, signOut } from '../firebaseConfig';
import './AdminLayout.css'; // [중요] 기존 레이아웃 CSS를 임포트합니다.

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/admin-login');
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  };

  return (
    <div className="admin-layout">
      <aside>
        <h1>HELLO PIGGY</h1>
        <div className="admin-user-info" onClick={handleLogout} title="로그아웃">
          안녕하세요 관리자님 :)
          <span className="logout-icon">→</span>
        </div>
        <nav>
          {/* 리뷰어 관리 */}
          <h3 className="menu-section-title">리뷰어 관리</h3>
          <NavLink to="/admin/reviewer/reviews">리뷰 접수 관리</NavLink>
          <NavLink to="/admin/reviewer/members">회원 관리</NavLink>
          <NavLink to="/admin/reviewer/products">리뷰 상품 관리</NavLink>
          <NavLink to="/admin/reviewer/settlement">정산 관리</NavLink>
          <NavLink to="/admin/reviewer/settlement-complete">정산 완료 내역</NavLink>
          
          {/* 판매자/캠페인 관리 */}
          <h3 className="menu-section-title">판매자/캠페인 관리</h3>
          <NavLink to="/admin/selleradmin/dashboard">대시보드</NavLink>
          <NavLink to="/admin/selleradmin/products">캠페인 관리</NavLink>
          <NavLink to="/admin/selleradmin/sellers">판매자 목록</NavLink>
          <NavLink to="/admin/selleradmin/schedule">예약 시트 관리</NavLink>
          <NavLink to="/admin/selleradmin/progress">진행현황</NavLink>
        </nav>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}