// src/pages/PrivateRoute.jsx (역할 기반 접근 제어 최종본)

import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { onAuthStateChanged, auth, db, doc, getDoc } from '../firebaseConfig';

// 역할에 따라 허용된 경로의 시작 부분을 정의
const rolePermissions = {
  admin: ['/admin/reviewer', '/admin/selleradmin'],
  seller: ['/seller', '/dashboard/payment'],
  reviewer: ['/my-reviews'], // 리뷰어는 my-reviews 페이지만 접근 가능
};

export default function PrivateRoute() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        let userRole = 'reviewer'; // 기본 역할
        
        // 1. admins 컬렉션에서 역할 확인
        const adminDocRef = doc(db, 'admins', authUser.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists() && adminDocSnap.data().role === 'admin') {
          userRole = 'admin';
        } else {
          // 2. sellers 컬렉션에서 역할 확인
          const sellerDocRef = doc(db, 'sellers', authUser.uid);
          const sellerSnap = await getDoc(sellerDocRef);
          if (sellerSnap.exists() && sellerSnap.data().role === 'seller') {
            userRole = 'seller';
          }
        }
        
        setUser({ ...authUser, role: userRole });

      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setIsAuthorized(false);
      return;
    }

    const allowedPaths = rolePermissions[user.role] || [];
    const isPathAllowed = allowedPaths.some(path => location.pathname.startsWith(path));
    
    setIsAuthorized(isPathAllowed);

  }, [user, location.pathname, loading]);

  if (loading) {
    return <div>권한 확인 중...</div>;
  }
  
  // 권한이 있으면 자식 라우트를 보여주고, 없으면 역할에 맞는 로그인 페이지로 리디렉션
  if (user && isAuthorized) {
    return <Outlet />;
  } else {
    // 접근하려던 경로에 따라 적절한 로그인 페이지로 안내
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin-login" replace />;
    }
    if (location.pathname.startsWith('/seller')) {
      return <Navigate to="/seller-login" replace />;
    }
    // 기본적으로는 리뷰어 로그인 페이지로
    return <Navigate to="/reviewer-login" replace />;
  }
}