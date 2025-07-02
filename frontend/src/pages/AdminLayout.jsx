// src/pages/AdminLayout.jsx

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { auth, signOut } from '../firebaseConfig';
import './AdminLayout.css'; // 공통 레이아웃 CSS

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
          <NavLink to="/admin/links">링크관리</NavLink>
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