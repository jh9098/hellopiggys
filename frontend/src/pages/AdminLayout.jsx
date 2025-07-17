// src/pages/AdminLayout.jsx (모든 관리 기능을 포함하는 최종본)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth, signOut } from '../firebaseConfig';
import './AdminLayout.css'; // 같은 폴더에 있는 CSS를 임포트

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
          {/* --- 기존 리뷰어 관리 메뉴 --- */}
          <h3 className="menu-section-title">리뷰어 관리</h3>
          <NavLink to="/admin/members">회원 관리</NavLink>
          <NavLink to="/admin/products">상품 등록 및 관리</NavLink>
          <NavLink to="/admin/reviews">리뷰어 구매 관리</NavLink>
          <NavLink to="/admin/settlement">정산 관리</NavLink>
          <NavLink to="/admin/settlement-complete">정산 완료 내역</NavLink>

          {/* --- 신규 판매자/캠페인 관리 메뉴 --- */}
          <h3 className="menu-section-title">판매자/캠페인 관리</h3>
          <NavLink to="/admin/seller-dashboard">대시보드</NavLink>
          <NavLink to="/admin/seller-products">캠페인 관리</NavLink>
          <NavLink to="/admin/seller-list">판매자 목록</NavLink>
          <NavLink to="/admin/seller-schedule">예약 시트 관리</NavLink>
          <NavLink to="/admin/seller-progress">진행현황</NavLink>
          <NavLink to="/admin/seller-traffic">트래픽 설정</NavLink>
        </nav>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
