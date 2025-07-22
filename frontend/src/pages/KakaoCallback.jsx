import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import axios from 'axios';
import { auth } from '../firebaseConfig';

export default function KakaoCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKakaoLogin = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      if (!code) {
        navigate('/reviewer-login');
        return;
      }
      try {
        const tokenRes = await axios.post(
          'https://kauth.kakao.com/oauth/token',
          null,
          {
            params: {
              grant_type: 'authorization_code',
              client_id: import.meta.env.VITE_KAKAO_REST_KEY,
              redirect_uri: import.meta.env.VITE_KAKAO_REDIRECT_URI,
              code,
              client_secret: import.meta.env.VITE_KAKAO_CLIENT_SECRET,
            },
          },
        );
        const accessToken = tokenRes.data.access_token;
        const userRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const name = userRes.data.kakao_account?.profile?.nickname;
        const phoneRaw = userRes.data.kakao_account?.phone_number || '';
        const phone = phoneRaw.replace(/[^0-9]/g, '');
        if (!name || !phone) throw new Error('필수 정보 누락');

        const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
        const url = `https://asia-northeast3-${projectId}.cloudfunctions.net/createCustomToken`;
        const customRes = await axios.post(url, { data: { name, phone } });
        const customToken = customRes.data.data.token;
        await signInWithCustomToken(auth, customToken);
        navigate('/reviewer/my-reviews', { replace: true });
      } catch (err) {
        console.error('Kakao login failed', err);
        navigate('/reviewer-login');
      }
    };
    handleKakaoLogin();
  }, [navigate]);

  return <p style={{textAlign:'center', padding:'50px'}}>카카오 로그인 처리 중...</p>;
}
