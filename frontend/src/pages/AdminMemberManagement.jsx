// src/pages/AdminMemberManagement.jsx

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy } from '../firebaseConfig';

// 날짜를 'YYYY. MM. DD.' 형식으로 변환하는 헬퍼 함수
const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate(); // Firebase Timestamp를 JavaScript Date 객체로 변환
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

export default function AdminMemberManagement() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchMembers = async () => {
            setLoading(true);
            const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(reviewsQuery);
            const reviews = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const memberData = reviews.reduce((acc, review) => {
                const { phoneNumber, name, createdAt } = review;
                if (phoneNumber) {
                    if (!acc[phoneNumber]) {
                        acc[phoneNumber] = {
                            phoneNumber,
                            name,
                            joinDate: createdAt,
                            submissionCount: 0,
                        };
                    }
                    acc[phoneNumber].submissionCount += 1;
                    if (createdAt.seconds > acc[phoneNumber].joinDate.seconds) {
                        acc[phoneNumber].name = name;
                        acc[phoneNumber].joinDate = createdAt;
                    }
                }
                return acc;
            }, {});

            const memberList = Object.values(memberData).sort((a,b) => b.joinDate.seconds - a.joinDate.seconds);
            setMembers(memberList);
            setLoading(false);
        };

        fetchMembers();
    }, []);

    const paginatedMembers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return members.slice(startIndex, startIndex + itemsPerPage);
    }, [members, currentPage]);

    const totalPages = Math.ceil(members.length / itemsPerPage);

    const goToPage = (page) => {
        if (page > 0 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (loading) {
        return <p>회원 정보를 불러오는 중...</p>;
    }

    return (
        <>
            <h2>회원 관리 ({members.length}명)</h2>
            <table>
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>전화번호</th>
                        <th>참여횟수</th>
                        <th>최근 참여일</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedMembers.map(member => (
                        <tr key={member.phoneNumber}>
                            <td>{member.name}</td>
                            <td>{member.phoneNumber}</td>
                            <td>{member.submissionCount}회</td>
                            <td>{formatDate(member.joinDate)}</td>
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
        </>
    );
}