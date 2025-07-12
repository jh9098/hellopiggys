// src/pages/AdminLayout.jsx (기존 hellopiggy 스타일 적용 최종본)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth, signOut } from '../firebaseConfig';
import './AdminLayout.css'; // [추가] AdminLayout 전용 CSS를 임포트합니다.

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
          {/* NavLink는 활성 링크에 active 클래스를 자동으로 추가해 줍니다. */}
          <NavLink to="/admin/members">회원관리</NavLink>
          <NavLink to="/admin/products">상품관리</NavLink>
          <NavLink to="/admin/reviews">리뷰관리</NavLink>
          <NavLink to="/admin/settlement">정산내역</NavLink>
          <NavLink to="/admin/settlement-complete">정산완료</NavLink>
        </nav>
      </aside>
      <main>
        {/* 자식 라우트의 컴포넌트가 이 자리에 렌더링됩니다. */}
        <Outlet />
      </main>
    </div>
  );
}