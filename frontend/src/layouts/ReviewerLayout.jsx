import { NavLink, Outlet } from 'react-router-dom';

export default function ReviewerLayout() {
  const activeClassName = 'bg-gray-900 text-white p-2 rounded block';
  const inactiveClassName = 'hover:bg-gray-700 p-2 rounded block';

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* 모바일 상단 메뉴 */}
      <header className="md:hidden bg-gray-800 text-white flex justify-around p-4">
        <NavLink
          to="/reviewer/link"
          className={({ isActive }) =>
            isActive ? 'font-bold border-b-2 border-white' : 'opacity-75'}
        >
          구매폼 작성
        </NavLink>
        <NavLink
          to="/reviewer/my-reviews"
          className={({ isActive }) =>
            isActive ? 'font-bold border-b-2 border-white' : 'opacity-75'}
        >
          나의 리뷰관리
        </NavLink>
      </header>

      {/* 데스크톱 사이드바 */}
      <aside className="hidden md:block w-64 bg-gray-800 text-white p-4">
        <h1 className="text-2xl font-bold mb-8">리뷰어 페이지</h1>
        <nav>
          <ul>
            <li className="mb-2">
              <NavLink
                to="/reviewer/link"
                className={({ isActive }) =>
                  isActive ? activeClassName : inactiveClassName}
              >
                구매폼 작성
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink
                to="/reviewer/my-reviews"
                className={({ isActive }) =>
                  isActive ? activeClassName : inactiveClassName}
              >
                나의 리뷰관리
              </NavLink>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8 bg-gray-100">
        <Outlet />
      </main>
    </div>
  );
}
