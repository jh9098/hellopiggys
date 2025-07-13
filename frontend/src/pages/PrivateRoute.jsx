// src/pages/PrivateRoute.jsx (admin 권한 강화 최종본)

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
    if (location.pathname.startsWith('/admin')) return <Navigate to="/admin-login" replace />;
    if (location.pathname.startsWith('/seller')) return <Navigate to="/seller-login" replace />;
    return <Navigate to="/reviewer-login" replace />;
  }
  
  // ▼▼▼ 여기에 admin 역할이면 모든 검사를 통과시키는 로직 추가 ▼▼▼
  // 사용자의 역할이 'admin'이면, 더 이상 다른 조건을 검사할 필요 없이 즉시 접근을 허용합니다.
  if (authState.role === 'admin') {
    return <Outlet />;
  }
  // ▲▲▲ admin 프리패스 로직 추가 완료 ▲▲▲

  // 사용자가 있지만, 현재 경로에 접근 권한이 없는 경우
  // (이 로직은 admin이 아닌 사용자에게만 적용됩니다)
  const path = location.pathname;
  if (path.startsWith('/admin') && authState.role !== 'admin') { // 이 조건은 사실상 위에서 걸러져서 불필요하지만, 명시적으로 둡니다.
    return <Navigate to="/admin-login" replace />;
  }
  if (path.startsWith('/seller') && authState.role !== 'seller') {
    return <Navigate to="/seller-login" replace />;
  }

  // 모든 검사를 통과한 경우, 요청한 페이지를 보여줌
  return <Outlet />;
}