// src/pages/AdminLayout.jsx (트래픽 관리 메뉴 추가)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { auth, signOut } from '../firebaseConfig';
import './AdminLayout.css';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [reviewerOpen, setReviewerOpen] = useState(true);
  const [sellerOpen, setSellerOpen] = useState(true);

  useEffect(() => {
    const checkMobile = () => window.innerWidth <= 768;
    const handleResize = () => setIsMobile(checkMobile());

    setIsMobile(checkMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setReviewerOpen(false);
      setSellerOpen(false);
    } else {
      setReviewerOpen(true);
      setSellerOpen(true);
    }
  }, [isMobile]);

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
        <Button variant="outline" size="sm" className="w-full mb-4" onClick={handleLogout}>로그아웃</Button>
        <nav>
          {/* --- 기존 리뷰어 관리 메뉴 --- */}
          <h3
            className="menu-section-title" 
            onClick={() => isMobile && setReviewerOpen(!reviewerOpen)}
          >
            리뷰어 관리
          </h3>
          {(!isMobile || reviewerOpen) && (
            <>
              <NavLink
                to="/admin/members"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                회원 관리
              </NavLink>
              <NavLink
                to="/admin/products"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                상품 등록 및 관리
              </NavLink>
              <NavLink
                to="/admin/reviews"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                리뷰어 구매 관리
              </NavLink>
              <NavLink
                to="/admin/settlement"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                정산 관리
              </NavLink>
              <NavLink
                to="/admin/settlement-complete"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                정산 완료 내역
              </NavLink>
            </>
          )}

          {/* --- 신규 판매자/캠페인 관리 메뉴 --- */}
          <h3
            className="menu-section-title"
            onClick={() => isMobile && setSellerOpen(!sellerOpen)}
          >
            판매자/캠페인 관리
          </h3>
          {(!isMobile || sellerOpen) && (
            <>
              <NavLink
                to="/admin/seller-dashboard"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                대시보드
              </NavLink>
              <NavLink
                to="/admin/seller-products"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                캠페인 관리
              </NavLink>
              {/* [추가] 트래픽 관리 메뉴 */}
              <NavLink
                to="/admin/seller-traffic-management"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                트래픽 관리
              </NavLink>
              <NavLink
                to="/admin/seller-list"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                판매자 목록
              </NavLink>
              <NavLink
                to="/admin/seller-schedule"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                예약 시트 관리
              </NavLink>
              <NavLink
                to="/admin/seller-progress"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                진행현황
              </NavLink>
              <NavLink
                to="/admin/seller-traffic"
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: isActive ? 'secondary' : 'ghost', size: 'sm' }),
                    'justify-start w-full'
                  )
                }
              >
                트래픽 설정
              </NavLink>
            </>
          )}
        </nav>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}