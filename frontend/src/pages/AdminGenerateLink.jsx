// src/pages/AdminGenerateLink.jsx (수정된 전체 코드)

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, collection, addDoc, serverTimestamp, updateDoc, doc, getDoc } from '../firebaseConfig';

export default function AdminGenerateLink() {
  const { linkId } = useParams(); // URL에서 linkId를 가져옵니다.
  const isEditMode = Boolean(linkId); // linkId가 있으면 수정 모드

  const [form, setForm] = useState({ title: '', purchaseLink: '', content: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEditMode); // 수정 모드일 때만 초기에 로딩
  const navigate = useNavigate();

  // 수정 모드일 경우, 기존 데이터를 불러옵니다.
  useEffect(() => {
    if (isEditMode) {
      const fetchLinkData = async () => {
        const docRef = doc(db, 'links', linkId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setForm(docSnap.data());
        } else {
          alert('해당 링크 정보를 찾을 수 없습니다.');
          navigate('/admin/links');
        }
        setLoading(false);
      };
      fetchLinkData();
    }
  }, [isEditMode, linkId, navigate]);

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
      if (isEditMode) {
        // 수정 모드: 기존 문서를 업데이트합니다.
        const docRef = doc(db, 'links', linkId);
        await updateDoc(docRef, {
          title: form.title,
          purchaseLink: form.purchaseLink,
          content: form.content,
        });
        alert('링크가 성공적으로 수정되었습니다.');
      } else {
        // 생성 모드: 새 문서를 추가합니다.
        const newDocRef = await addDoc(collection(db, 'links'), {
          ...form,
          createdAt: serverTimestamp(),
        });
        const generatedLink = `${window.location.origin}/link/${newDocRef.id}`;
        await updateDoc(newDocRef, {
          id: newDocRef.id,
          generatedLink: generatedLink,
        });
        alert('링크가 성공적으로 생성되었습니다.');
      }
      navigate('/admin/links');
    } catch (error) {
      alert(`오류가 발생했습니다: ${error.message}`);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <p>링크 정보를 불러오는 중...</p>;
  }

  return (
    <>
      <h2>{isEditMode ? '링크 수정' : '링크 생성'}</h2>
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
            {isSubmitting ? '저장 중...' : (isEditMode ? '수정 완료' : '링크 등록')}
          </button>
        </div>
      </form>
    </>
  );
}