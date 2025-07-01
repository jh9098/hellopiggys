import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function AdminReviewList() {
  const [rows, setRows] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('ADMIN_ID_TOKEN'); // 로그인 시 저장해 둔다고 가정
      const res = await axios.get(`${API}/api/reviews`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRows(res.data);
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h2>관리자 – 리뷰 목록</h2>
      <table border="1" cellPadding="6">
        <thead>
          <tr>
            <th>ID</th>
            <th>이름</th>
            <th>전화</th>
            <th>제목</th>
            <th>제출일</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} onClick={() => nav(`/reviews/${r.id}`)} style={{ cursor: 'pointer' }}>
              <td>{r.id.slice(0, 6)}…</td>
              <td>{r.name}</td>
              <td>{r.phoneNumber}</td>
              <td>{r.title}</td>
              <td>{new Date(r.createdAt._seconds * 1000).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminReviewList;
