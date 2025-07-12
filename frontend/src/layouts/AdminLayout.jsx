// src/layouts/AdminLayout.jsx (최종 확인 버전)

import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  const activeClassName = "bg-gray-900 text-white p-2 rounded block";
  const inactiveClassName = "hover:bg-gray-700 p-2 rounded block";

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold mb-8">관리자 페이지</h1>
        <nav>
          <ul>
            <li className="mb-4">
              <NavLink to="/admin/dashboard" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                대시보드
              </NavLink>
            </li>
            <li className="mb-4">
              <NavLink to="/admin/products" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                상품 관리
              </NavLink>
            </li>
            <li className="mb-4">
              <NavLink to="/admin/sellers" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                판매자 관리
              </NavLink>
            </li>
            <li className="mb-4">
              <NavLink to="/admin/schedule" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
                예약 시트 관리
              </NavLink>
            </li>
            <li className="mb-4">
              <NavLink to="/admin/progress" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>
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