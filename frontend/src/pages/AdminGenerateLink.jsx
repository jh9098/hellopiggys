// src/pages/AdminGenerateLink.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, addDoc, serverTimestamp, updateDoc } from '../firebaseConfig';

export default function AdminGenerateLink() {
  const [form, setForm] = useState({ title: '', purchaseLink: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title) {
      alert('제목을 입력해주세요.');
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. 먼저 내용을 저장하고 문서 참조를 받음
      const newDocRef = await addDoc(collection(db, 'links'), {
        ...form,
        createdAt: serverTimestamp(),
      });

      // 2. 생성된 문서 ID로 링크를 만들어 다시 업데이트
      const generatedLink = `${window.location.origin}/link/${newDocRef.id}`;
      await updateDoc(newDocRef, {
        id: newDocRef.id,
        generatedLink: generatedLink,
      });

      alert('링크가 성공적으로 생성되었습니다.');
      navigate('/admin/links');
    } catch (error) {
      alert('링크 생성에 실패했습니다: ' + error.message);
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <h2>링크 생성</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <label style={{ display: 'inline-block', width: '100px' }}>제목</label>
          <input type="text" name="title" value={form.title} onChange={handleChange} placeholder="제목을 입력하세요." required style={{width: 'calc(100% - 120px)', padding: '8px'}}/>
        </div>
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          <label style={{ display: 'inline-block', width: '100px' }}>구매링크</label>
          <input type="url" name="purchaseLink" value={form.purchaseLink} onChange={handleChange} placeholder="https://..." style={{width: 'calc(100% - 120px)', padding: '8px'}}/>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '8px' }}>내용</label>
          <textarea name="content" value={form.content} onChange={handleChange} placeholder="리뷰 작성 페이지 상단에 표시될 안내 내용을 입력하세요." style={{ width: '100%', minHeight: '150px', padding: '8px' }}></textarea>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={() => navigate('/admin/links')} disabled={isSubmitting} style={{padding: '10px 20px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff'}}>
            닫기
          </button>
          <button type="submit" disabled={isSubmitting} style={{padding: '10px 20px', border: 'none', borderRadius: '4px', background: '#000', color: '#fff'}}>
            {isSubmitting ? '등록 중...' : '링크 등록'}
          </button>
        </div>
      </form>
    </>
  );
}