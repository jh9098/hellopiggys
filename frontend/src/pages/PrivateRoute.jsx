// src/pages/PrivateRoute.jsx  (또는 src/components/PrivateRoute.jsx)

import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { auth, onAuthStateChanged, db, doc, getDoc } from '../firebaseConfig';

const checkAdminStatus = async (user) => {
  if (!user) return false;
  const adminDocRef = doc(db, 'admins', user.uid);
  const adminDocSnap = await getDoc(adminDocRef);
  return adminDocSnap.exists() && adminDocSnap.data().role === 'admin';
};

export default function PrivateRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged는 인증 상태 변경을 감지하는 리스너입니다.
    // 컴포넌트가 언마운트될 때 리스너를 정리하기 위해 unsubscribe 함수를 반환합니다.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const isAdminUser = await checkAdminStatus(user);
        setIsAuthenticated(true);
        setIsAdmin(isAdminUser);
      } else {
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
      setLoading(false); // 인증 상태 확인 완료
    });

    return () => unsubscribe(); // 클린업 함수
  }, []);

  if (loading) {
    return <p style={{ textAlign: 'center', padding: '50px' }}>권한 확인 중...</p>;
  }

  // 인증되었고, 관리자일 경우에만 자식 라우트(Outlet)를 렌더링
  if (isAuthenticated && isAdmin) {
    return <Outlet />;
  }
  
  // 그 외의 모든 경우는 로그인 페이지로 리다이렉트
  return <Navigate to="/admin-login" replace />;
}