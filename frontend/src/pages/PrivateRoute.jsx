// src/pages/PrivateRoute.jsx (세분화된 권한 제어 최종본)

import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { onAuthStateChanged, auth, db, doc, getDoc } from '../firebaseConfig';

export default function PrivateRoute() {
  const [authState, setAuthState] = useState({
    loading: true, // 처음에는 항상 로딩 상태
    user: null,
    role: null,
  });
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        let userRole = 'reviewer'; // 기본 역할
        
        const adminDoc = await getDoc(doc(db, 'admins', authUser.uid));
        if (adminDoc.exists() && adminDoc.data().role === 'admin') {
          userRole = 'admin';
        } else {
          const sellerDoc = await getDoc(doc(db, 'sellers', authUser.uid));
          if (sellerDoc.exists() && sellerDoc.data().role === 'seller') {
            userRole = 'seller';
          }
        }
        
        setAuthState({ loading: false, user: authUser, role: userRole });
      } else {
        setAuthState({ loading: false, user: null, role: null });
      }
    });
    return () => unsubscribe();
  }, []);

  if (authState.loading) {
    return <div style={{ textAlign: 'center', padding: '50px' }}>권한 확인 중...</div>;
  }

  // --- 1. 로그아웃 상태일 때: 무조건 로그인 페이지로 ---
  if (!authState.user) {
    // 접근하려던 경로에 따라 적절한 로그인 페이지로 안내
    if (location.pathname.startsWith('/admin')) return <Navigate to="/admin-login" replace />;
    if (location.pathname.startsWith('/seller')) return <Navigate to="/seller-login" replace />;
    // 그 외 모든 경로는 기본 로그인 페이지로
    return <Navigate to="/reviewer-login" replace />;
  }
  
  // --- 2. 로그인 상태일 때: 경로와 역할에 따른 권한 검사 ---
  const { role } = authState;
  const path = location.pathname;

  // 2-1. '/admin' 경로에 대한 규칙
  if (path.startsWith('/admin')) {
    if (role === 'admin') {
      return <Outlet />; // admin이면 통과
    }
    // admin이 아니면 관리자 로그인 페이지로 리디렉션
    return <Navigate to="/admin-login" replace />; 
  }

  // 2-2. '/seller' 경로에 대한 규칙
  if (path.startsWith('/seller')) {
    if (role === 'admin' || role === 'seller') {
      return <Outlet />; // admin 또는 seller이면 통과
    }
    // 둘 다 아니면 판매자 로그인 페이지로 리디렉션
    return <Navigate to="/seller-login" replace />;
  }

  // 2-3. '/link' 경로 및 그 외 모든 경로에 대한 규칙
  // 이 코드가 실행된다는 것은, 경로가 '/admin'도 '/seller'도 아니라는 의미입니다.
  // 로그인만 되어 있다면 누구나 접근 가능하므로, 바로 통과시킵니다.
  return <Outlet />;
}