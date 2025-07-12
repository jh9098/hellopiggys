// src/layouts/SellerLayout.jsx (최종 완성본)

import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';

export default function SellerLayout() {
  const [open, setOpen] = useState({ experience: true, traffic: false, kita: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggle = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const activeClassName = "bg-gray-900 text-white p-2 rounded block";
  const inactiveClassName = "hover:bg-gray-700 p-2 rounded block";

  return (
    <div className="flex min-h-screen">
      {/* 모바일 화면용 사이드바 배경 */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-10 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 bg-gray-800 text-white p-4 transform transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <h1 className="text-2xl font-bold mb-8">판매자 페이지</h1>
        <nav>
          <ul>
            <li className="mb-4">
              <button onClick={() => toggle('experience')} className="w-full text-left hover:bg-gray-700 p-2 rounded flex justify-between items-center">
                체험단 <span>{open.experience ? '−' : '+'}</span>
              </button>
              {open.experience && (
                <ul className="ml-4 mt-2 space-y-2">
                  <li><NavLink to="/seller/dashboard" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>예약 현황</NavLink></li>
                  <li><NavLink to="/seller/reservation" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>예약하기</NavLink></li>
                  <li><NavLink to="/seller/progress" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>진행현황</NavLink></li>
                </ul>
              )}
            </li>
            <li className="mb-4">
              <button onClick={() => toggle('traffic')} className="w-full text-left hover:bg-gray-700 p-2 rounded flex justify-between items-center">
                트래픽 <span>{open.traffic ? '−' : '+'}</span>
              </button>
              {open.traffic && (
                <ul className="ml-4 mt-2 space-y-2">
                  <li><NavLink to="/seller/traffic" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>트래픽 요청</NavLink></li>
                </ul>
              )}
            </li>
            <li className="mb-4">
              <button onClick={() => toggle('kita')} className="w-full text-left hover:bg-gray-700 p-2 rounded flex justify-between items-center">
                기타 <span>{open.kita ? '−' : '+'}</span>
              </button>
              {open.kita && (
                <ul className="ml-4 mt-2 space-y-2">
                  <li><NavLink to="/seller/keyword" className={({ isActive }) => isActive ? activeClassName : inactiveClassName}>키워드분석</NavLink></li>
                </ul>
              )}
            </li>
          </ul>
        </nav>
      </aside>

      {/* 메인 컨텐츠 영역 */}
      <div className="flex flex-col flex-1">
        {/* 모바일용 햄버거 버튼 */}
        <button
          className="p-2 m-2 text-gray-700 bg-gray-200 rounded-md md:hidden fixed top-2 left-2 z-30"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          ☰
        </button>
        <main className="flex-1 p-4 sm:p-8 bg-gray-100">
          {/* 자식 페이지(SellerReservation 등)가 이 자리에 렌더링됩니다. */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}