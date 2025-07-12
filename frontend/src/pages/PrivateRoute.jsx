// src/pages/PrivateRoute.jsx  (또는 src/components/PrivateRoute.jsx)

import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { auth, onAuthStateChanged, db, doc, getDoc } from '../firebaseConfig';

const checkUserRole = async (user) => {
  if (!user) return null;

  const adminDoc = await getDoc(doc(db, 'admins', user.uid));
  if (adminDoc.exists() && adminDoc.data().role === 'admin') {
    return 'admin';
  }

  const sellerDoc = await getDoc(doc(db, 'sellers', user.uid));
  if (sellerDoc.exists() && sellerDoc.data().role === 'seller') {
    return 'seller';
  }

  return null;
};

export default function PrivateRoute() {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // onAuthStateChanged는 인증 상태 변경을 감지하는 리스너입니다.
    // 컴포넌트가 언마운트될 때 리스너를 정리하기 위해 unsubscribe 함수를 반환합니다.
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const userRole = await checkUserRole(user);
      setRole(userRole);
      setLoading(false); // 인증 상태 확인 완료
    });

    return () => unsubscribe(); // 클린업 함수
  }, []);

  if (loading) {
    return <p style={{ textAlign: 'center', padding: '50px' }}>권한 확인 중...</p>;
  }

  if (!role) {
    // 로그인되지 않았거나 권한이 없을 때 경로에 따라 로그인 페이지로 이동
    if (location.pathname.startsWith('/admin')) {
      return <Navigate to="/admin-login" replace />;
    }
    return <Navigate to="/seller-login" replace />;
  }

  if (location.pathname.startsWith('/admin') && role !== 'admin') {
    return <Navigate to="/admin-login" replace />;
  }

  if (location.pathname.startsWith('/seller') && role !== 'seller' && role !== 'admin') {
    return <Navigate to="/seller-login" replace />;
  }

  return <Outlet />;
}