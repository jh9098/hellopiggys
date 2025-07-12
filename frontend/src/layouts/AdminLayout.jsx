// src/layouts/AdminLayout.jsx (리뷰어/판매자 관리 메뉴 통합 최종본)

import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const activeClassName = "bg-gray-900 text-white p-2 rounded block";
  const inactiveClassName = "hover:bg-gray-700 p-2 rounded block";

  // 메뉴 그룹핑을 위한 스타일
  const sectionTitleClass = "mt-8 mb-2 px-2 text-xs font-bold text-gray-400 uppercase tracking-wider";

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold mb-8">관리자 페이지</h1>
        <nav>
          {/* ─── 1. 기존 리뷰어 관리 메뉴 ─── */}
          <h3 className={sectionTitleClass}>리뷰어 관리</h3>
          <ul>
            <li className="mb-2">
              <NavLink to="/admin/reviews" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                리뷰 접수 관리
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/members" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                회원 관리
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/products" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                리뷰 상품 관리
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/settlement" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                정산 관리
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/settlement-complete" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                정산 완료 내역
              </NavLink>
            </li>
          </ul>

          {/* ─── 2. 신규 판매자 관리 메뉴 ─── */}
          <h3 className={sectionTitleClass}>판매자 관리</h3>
          <ul>
            <li className="mb-2">
              <NavLink to="/admin/selleradmin/dashboard" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                대시보드
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/selleradmin/products" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                캠페인 관리
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/selleradmin/sellers" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                판매자 목록
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/selleradmin/schedule" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                예약 시트 관리
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink to="/admin/selleradmin/progress" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                진행현황
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 p-8 bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
}