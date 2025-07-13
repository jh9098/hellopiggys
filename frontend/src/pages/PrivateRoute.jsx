// src/pages/PrivateRoute.jsx (비동기 상태 관리 개선 최종본)

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

  // 사용자가 없는 경우(로그아웃 상태)
  if (!authState.user) {
    // 접근하려던 경로에 따라 적절한 로그인 페이지로 안내
    if (location.pathname.startsWith('/admin')) return <Navigate to="/admin-login" replace />;
    if (location.pathname.startsWith('/seller')) return <Navigate to="/seller-login" replace />;
    return <Navigate to="/reviewer-login" replace />;
  }

  // 사용자가 있지만, 현재 경로에 접근 권한이 없는 경우
  const path = location.pathname;
  if (path.startsWith('/admin') && authState.role !== 'admin') {
    return <Navigate to="/admin-login" replace />;
  }
  if (path.startsWith('/seller') && !['seller', 'admin'].includes(authState.role)) {
    return <Navigate to="/seller-login" replace />;
  }

  // 모든 검사를 통과한 경우, 요청한 페이지를 보여줌
  return <Outlet />;
}