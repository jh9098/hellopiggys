import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  db,
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  getDoc,
} from '../firebaseConfig';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function ReviewDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('ADMIN_ID_TOKEN');
      const res = await axios.get(`${API}/api/reviews/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setData(res.data);
    })();
  }, [id]);

  if (!data) return <p style={{ padding: 24 }}>로딩중…</p>;

  return (
    <div style={{ padding: 24 }}>
      <h2>리뷰 상세</h2>
      <p><strong>작성자</strong> {data.name} / {data.phoneNumber}</p>
      <p><strong>주문번호</strong> {data.orderNumber}</p>
      <p><strong>제목</strong> {data.title}</p>
      <p><strong>내용</strong> {data.content}</p>

      <h3>첨부 이미지</h3>
      {['likeImageUrl','orderImageUrl','secondOrderImageUrl','reviewImageUrl'].map(
        key => data[key] && (
          <div key={key} style={{ marginBottom: 12 }}>
            <p>{key}</p>
            <img src={data[key]} alt={key} width="300" />
          </div>
        )
      )}
    </div>
  );
}

export default ReviewDetail;
