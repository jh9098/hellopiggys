// src/pages/AdminLinkManagement.jsx (수정된 전체 코드)

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc } from '../firebaseConfig';

const formatDate = (date) => date ? date.toDate().toLocaleString() : 'N/A';

export default function AdminLinkManagement() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    setLoading(true); // 데이터를 다시 불러올 때 로딩 상태로 설정
    const q = query(collection(db, 'links'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    setLinks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 링크를 삭제하시겠습니까?')) {
      try {
        await deleteDoc(doc(db, 'links', id));
        alert('링크가 삭제되었습니다.');
        fetchLinks(); // 목록 새로고침
      } catch (error) {
        alert('삭제 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  if (loading) return <p>링크 목록을 불러오는 중...</p>;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>링크 관리 ({links.length})</h2>
        <Link to="/admin/links/new" style={{
            padding: '8px 16px', 
            backgroundColor: '#000', 
            color: '#fff', 
            textDecoration: 'none',
            borderRadius: '4px'
        }}>
          링크 생성
        </Link>
      </div>

      {links.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed #ccc', borderRadius: '8px' }}>
          <p>생성된 링크가 없습니다.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{width: '30%'}}>제목</th>
              <th style={{width: '30%'}}>등록링크</th>
              <th style={{width: '15%'}}>등록날짜</th>
              <th style={{width: '25%'}}>관리</th>
            </tr>
          </thead>
          <tbody>
          {links.map(link => (
              <tr key={link.id}>
                <td style={{textAlign: 'left'}}>{link.title}</td>
                {/* 아래 td 태그의 style을 수정합니다. */}
                <td style={{
                  textAlign: 'left',
                  wordBreak: 'break-all', // <-- 이 속성을 추가!
                }}>
                  <a href={link.generatedLink} target="_blank" rel="noopener noreferrer">
                    {link.generatedLink}
                  </a>
                </td>
                <td>{formatDate(link.createdAt)}</td>
                <td style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                  <Link to={`/admin/links/edit/${link.id}`} style={{
                    backgroundColor: '#1976d2', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', textDecoration: 'none'
                  }}>
                    수정
                  </Link>
                  <button onClick={() => handleDelete(link.id)} style={{
                    backgroundColor: '#e53935', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer'
                  }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}