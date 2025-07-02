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
    const itemsPerPage = 10; // 한 페이지에 10개씩 표시

    useEffect(() => {
        const fetchMembers = async () => {
            setLoading(true);
            const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(reviewsQuery);
            const reviews = querySnapshot.docs.map(doc => doc.data());

            // 전화번호를 기준으로 리뷰를 그룹화하고 사용자 데이터 집계
            const memberData = reviews.reduce((acc, review) => {
                const { phoneNumber, name, createdAt } = review;

                if (!acc[phoneNumber]) {
                    // 이 전화번호의 첫 번째 리뷰인 경우, 새 멤버 정보 생성
                    acc[phoneNumber] = {
                        phoneNumber,
                        name, // 가장 최근 이름으로 덮어쓰여짐
                        joinDate: createdAt, // 가장 최근 날짜로 덮어쓰여짐
                        submissionCount: 0, // 참여 횟수 카운터 초기화
                    };
                }
                
                // 참여 횟수 증가
                acc[phoneNumber].submissionCount += 1;
                // 항상 최신 이름과 가입일로 유지 (orderBy 덕분에 첫 데이터가 최신)
                // (만약 이름을 바꿨을 경우를 대비)
                acc[phoneNumber].name = name; 
                acc[phoneNumber].joinDate = createdAt;

                return acc;
            }, {});

            // 객체를 배열로 변환
            const memberList = Object.values(memberData);
            setMembers(memberList);
            setLoading(false);
        };

        fetchMembers();
    }, []);

    // 페이지네이션 로직
    const paginatedMembers = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return members.slice(startIndex, endIndex);
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

            {/* 페이지네이션 UI */}
            <div className="pagination">
                <button onClick={() => goToPage(1)} disabled={currentPage === 1}><<</button>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}><</button>
                
                {/* 페이지 번호들 (예: ... 3 4 5 6 7 ...) */}
                {[...Array(totalPages).keys()].map(num => (
                    <button
                        key={num + 1}
                        onClick={() => goToPage(num + 1)}
                        className={currentPage === num + 1 ? 'active' : ''}
                    >
                        {num + 1}
                    </button>
                ))}
                
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>></button>
                <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>>></button>
            </div>
        </>
    );
}