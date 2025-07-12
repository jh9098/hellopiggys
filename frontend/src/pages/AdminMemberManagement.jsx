// src/pages/AdminMemberManagement.jsx

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, getDoc, doc } from '../firebaseConfig';
import MemberDetailModal from '../components/MemberDetailModal';

const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate();
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

export default function AdminMemberManagementPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

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
                        id: mainAccountId, mainAccountName: '로딩 중...', mainAccountPhone: '로딩 중...',
                        lastSubmissionDate: null, reviews: [],
                    };
                }
                membersData[mainAccountId].reviews.push(review);
                
                if (!membersData[mainAccountId].lastSubmissionDate || review.createdAt.seconds > membersData[mainAccountId].lastSubmissionDate.seconds) {
                    membersData[mainAccountId].lastSubmissionDate = review.createdAt;
                }
            }
            const memberList = Object.values(membersData);

            for (const member of memberList) {
                const userDoc = await getDoc(doc(db, 'users', member.id));
                if (userDoc.exists()) {
                    member.mainAccountName = userDoc.data().name;
                    member.mainAccountPhone = userDoc.data().phone;
                } else {
                    member.mainAccountName = '정보 없음';
                }
                for (const review of member.reviews) {
                    if (review.subAccountId) {
                        const subDoc = await getDoc(doc(db, 'subAccounts', review.subAccountId));
                        review.subAccountInfo = subDoc.exists() ? subDoc.data() : { name: '삭제된 계정' };
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
        if (searchName) data = data.filter(m => m.mainAccountName?.toLowerCase().includes(searchName.toLowerCase()));
        if (searchPhone) data = data.filter(m => m.mainAccountPhone?.includes(searchPhone));
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
    const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
    const requestSort = (key) => {
        let direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        setSortConfig({ key, direction });
    };

    const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');
    const handleOpenModal = (member) => { setSelectedMember(member); setIsModalOpen(true); };

    if (loading) return <p>회원 정보를 불러오는 중...</p>;

    return (
        <>
            <h2>회원 관리 ({processedMembers.length}명)</h2>
            <div className="toolbar">
                <input type="text" placeholder="이름 검색" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                <input type="text" placeholder="전화번호 검색" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
            </div>
            <div className="table-container">
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
                                <td><button onClick={() => handleOpenModal(member)}>보기</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="pagination">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1}>{'<<'}</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>{'<'}</button>
                {[...Array(totalPages).keys()].map(num => (<button key={num + 1} onClick={() => goToPage(num + 1)} className={currentPage === num + 1 ? 'active' : ''}>{num + 1}</button>))}
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>{'>'}</button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>{'>>'}</button>
            </div>
            {isModalOpen && <MemberDetailModal member={selectedMember} onClose={() => setIsModalOpen(false)} />}
        </>
    );
}