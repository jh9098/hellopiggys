// src/pages/AdminMemberManagement.jsx (데이터 가공 로직 수정)

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, getDoc, doc } from '../firebaseConfig';
import MemberDetailModal from '../components/MemberDetailModal';

const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate();
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

export default function AdminMemberManagement() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    // 검색 및 정렬 상태
    const [searchName, setSearchName] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    useEffect(() => {
        const fetchMemberData = async () => {
            setLoading(true);

            const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
            const reviewsSnapshot = await getDocs(reviewsQuery);
            const reviews = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const membersData = {};

            for (const review of reviews) {
                const { mainAccountId } = review;
                if (!mainAccountId) continue;

                if (!membersData[mainAccountId]) {
                    membersData[mainAccountId] = {
                        id: mainAccountId,
                        mainAccountName: '로딩 중...',
                        mainAccountPhone: '로딩 중...',
                        lastSubmissionDate: null,
                        reviews: [], // 해당 본계정이 제출한 모든 리뷰를 저장할 배열
                    };
                }

                membersData[mainAccountId].reviews.push(review);
                
                // 최신 리뷰 날짜로 업데이트
                if (!membersData[mainAccountId].lastSubmissionDate || review.createdAt.seconds > membersData[mainAccountId].lastSubmissionDate.seconds) {
                    membersData[mainAccountId].lastSubmissionDate = review.createdAt;
                }
            }

            const memberList = Object.values(membersData);

            for (const member of memberList) {
                // 본계정 정보(users 컬렉션) 가져오기
                const userDoc = await getDoc(doc(db, 'users', member.id));
                if (userDoc.exists()) {
                    member.mainAccountName = userDoc.data().name;
                    member.mainAccountPhone = userDoc.data().phone;
                } else {
                    member.mainAccountName = '정보 없음';
                }

                // 각 리뷰에 연결된 타계정 정보(subAccounts 컬렉션)를 가져와서 추가
                for (const review of member.reviews) {
                    if (review.subAccountId) {
                        const subDoc = await getDoc(doc(db, 'subAccounts', review.subAccountId));
                        if (subDoc.exists()) {
                            review.subAccountInfo = subDoc.data();
                        } else {
                            review.subAccountInfo = { name: '삭제된 계정' };
                        }
                    }
                }
            }
            
            memberList.sort((a, b) => b.lastSubmissionDate.seconds - a.lastSubmissionDate.seconds);
            setMembers(memberList);
            setLoading(false);
        };

        fetchMemberData();
    }, []);

    const processedMembers = useMemo(() => {
        let data = [...members];

        if (searchName) {
            data = data.filter(m => m.mainAccountName?.toLowerCase().includes(searchName.toLowerCase()));
        }

        if (searchPhone) {
            data = data.filter(m => m.mainAccountPhone?.includes(searchPhone));
        }

        if (sortConfig.key) {
            data.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [members, searchName, searchPhone, sortConfig]);

    const paginatedMembers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processedMembers.slice(startIndex, startIndex + itemsPerPage);
    }, [processedMembers, currentPage]);

    const totalPages = Math.ceil(processedMembers.length / itemsPerPage);

    const goToPage = (page) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const SortIndicator = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'asc' ? ' ▲' : ' ▼';
    };

    const handleOpenModal = (member) => {
        setSelectedMember(member);
        setIsModalOpen(true);
    };

    if (loading) {
        return <p>회원 정보를 불러오는 중...</p>;
    }

    return (
        <>
            <h2>회원 관리 ({processedMembers.length}명)</h2>
            <div className="search-bar" style={{ marginBottom: '10px' }}>
                <input
                    type="text"
                    placeholder="이름 검색"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    style={{ marginRight: '5px' }}
                />
                <input
                    type="text"
                    placeholder="전화번호 검색"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                />
            </div>
            <table>
                <thead>
                    <tr>
                        <th onClick={() => requestSort('mainAccountName')} className="sortable">본계정 이름<SortIndicator columnKey="mainAccountName" /></th>
                        <th onClick={() => requestSort('mainAccountPhone')} className="sortable">본계정 전화번호<SortIndicator columnKey="mainAccountPhone" /></th>
                        <th>총 참여횟수</th>
                        <th>최근 참여일</th>
                        <th>정보 보기</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedMembers.map(member => (
                        <tr key={member.id}>
                            <td>{member.mainAccountName}</td>
                            <td>{member.mainAccountPhone}</td>
                            <td>{member.reviews.length}회</td>
                            <td>{formatDate(member.lastSubmissionDate)}</td>
                            <td>
                                <button onClick={() => handleOpenModal(member)}>보기</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="pagination">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1}>{'<<'}</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>{'<'}</button>
                
                {[...Array(totalPages).keys()].map(num => (
                    <button
                        key={num + 1}
                        onClick={() => goToPage(num + 1)}
                        className={currentPage === num + 1 ? 'active' : ''}
                    >
                        {num + 1}
                    </button>
                ))}
                
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>{'>'}</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>{'>>'}</button>
            </div>

            {isModalOpen && (
                <MemberDetailModal 
                    member={selectedMember} 
                    onClose={() => setIsModalOpen(false)} 
                />
            )}
        </>
    );
}