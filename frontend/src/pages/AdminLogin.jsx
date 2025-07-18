// src/pages/AdminLogin.jsx (리디렉션 경로 수정)

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, signInWithEmailAndPassword, db, doc, getDoc } from '../firebaseConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const checkAdminStatus = async (user) => {
  if (!user) return false;
  try {
    const adminDocRef = doc(db, 'admins', user.uid);
    const adminDocSnap = await getDoc(adminDocRef);
    return adminDocSnap.exists() && adminDocSnap.data().role === 'admin';
  } catch (error) {
    console.error("관리자 상태 확인 중 오류:", error);
    return false;
  }
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw);
      const isAdmin = await checkAdminStatus(cred.user);

      if (isAdmin) {
        // [수정] 구체적인 페이지 대신, 관리자 메인 경로로 이동
        // App.jsx의 index route가 올바른 페이지로 다시 리디렉션해 줄 것임
        navigate('/admin', { replace: true }); 
      } else {
        await auth.signOut();
        setErr('관리자 권한이 없습니다.');
      }
    } catch (e) {
      if (e.code === 'auth/invalid-credential') {
        setErr('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setErr('로그인 중 오류가 발생했습니다.');
      }
      console.error(e);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">수리강 리뷰 관리자</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
            </div>
            {err && <p className="text-sm text-destructive">{err}</p>}
            <Button type="submit" className="w-full">로그인</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}