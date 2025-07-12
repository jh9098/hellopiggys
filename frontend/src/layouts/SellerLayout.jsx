// src/layouts/SellerLayout.jsx (반응형 사이드바 최종 수정본)

import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function SellerLayout() {
  const [open, setOpen] = useState({ experience: true, traffic: false, kita: false });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation(); // 현재 경로를 알기 위한 훅

  // 페이지가 변경될 때마다 모바일 사이드바를 닫아주는 효과
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggle = (key) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const activeClassName = "bg-gray-900 text-white p-2 rounded block";
  const inactiveClassName = "hover:bg-gray-700 p-2 rounded block";

  // 사이드바 메뉴 컴포넌트 분리 (가독성 향상)
  const SidebarContent = () => (
    <>
      <h1 className="text-2xl font-bold mb-8 text-white">판매자 페이지</h1>
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
    </>
  );

  return (
    <div className="relative min-h-screen md:flex">
      {/* 모바일 화면용 오버레이 */}
      {sidebarOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

      {/* 사이드바 */}
      <aside className={`fixed inset-y-0 left-0 bg-gray-800 text-white w-64 p-4 transform transition-transform z-30 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <SidebarContent />
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col">
        {/* 모바일용 햄버거 버튼 */}
        <div className="md:hidden flex justify-end p-2 sticky top-0 bg-gray-100 z-10">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2">
                ☰
            </button>
        </div>

        <main className="flex-1 p-4 sm:p-8 bg-gray-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}