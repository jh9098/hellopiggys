import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export default function AdminAccountMergePage() {
  const [destUid, setDestUid] = useState('');
  const [destPhone, setDestPhone] = useState('');
  const [sourceUid, setSourceUid] = useState('');
  const [sourcePhone, setSourcePhone] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleMerge = async () => {
    setLoading(true);
    setMessage('');
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API}/api/merge-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ destUid, destPhone, sourceUid, sourcePhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('계정 병합이 완료되었습니다.');
        setDestUid('');
        setDestPhone('');
        setSourceUid('');
        setSourcePhone('');
      } else {
        setMessage(data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md">
      <h2 className="mb-4 text-xl font-bold">계정 병합</h2>
      <div className="space-y-2 mb-4">
        <Input placeholder="본계정 UID" value={destUid} onChange={e => setDestUid(e.target.value)} />
        <Input placeholder="본계정 전화번호" value={destPhone} onChange={e => setDestPhone(e.target.value)} />
        <Input placeholder="타계정 UID" value={sourceUid} onChange={e => setSourceUid(e.target.value)} />
        <Input placeholder="타계정 전화번호" value={sourcePhone} onChange={e => setSourcePhone(e.target.value)} />
      </div>
      <Button onClick={handleMerge} disabled={loading}>
        {loading ? '처리 중...' : '병합 실행'}
      </Button>
      {message && <p className="mt-2 text-sm">{message}</p>}
    </div>
  );
}
