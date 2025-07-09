// src/pages/AdminMemberManagement.jsx (본계정 기준으로 전면 수정)

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, getDoc, doc } from '../firebaseConfig';
import MemberDetailModal from '../components/MemberDetailModal'; // 새로 만든 모달 import

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
    
    // 모달 상태 관리
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState(null);

    useEffect(() => {
        const fetchMemberData = async () => {
            setLoading(true);

            // 1. 모든 리뷰를 가져옵니다.
            const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
            const reviewsSnapshot = await getDocs(reviewsQuery);
            const reviews = reviewsSnapshot.docs.map(doc => ({ ...doc.data() }));

            // 2. mainAccountId를 기준으로 리뷰를 그룹화합니다.
            const membersData = {};

            for (const review of reviews) {
                const { mainAccountId, subAccountId, createdAt } = review;
                
                if (!mainAccountId) continue; // mainAccountId가 없는 리뷰는 건너뜁니다.

                // membersData에 해당 본계정이 없으면 초기화
                if (!membersData[mainAccountId]) {
                    membersData[mainAccountId] = {
                        id: mainAccountId,
                        mainAccountName: '로딩 중...',
                        mainAccountPhone: '로딩 중...',
                        totalSubmissions: 0,
                        lastSubmissionDate: null,
                        subAccounts: {}, // 이 본계정에 속한 타계정 정보를 저장할 객체
                    };
                }

                // 참여 횟수 및 최근 참여일 업데이트
                membersData[mainAccountId].totalSubmissions += 1;
                if (!membersData[mainAccountId].lastSubmissionDate || createdAt.seconds > membersData[mainAccountId].lastSubmissionDate.seconds) {
                    membersData[mainAccountId].lastSubmissionDate = createdAt;
                }

                // 타계정 정보 처리
                if (subAccountId) {
                    if (!membersData[mainAccountId].subAccounts[subAccountId]) {
                        membersData[mainAccountId].subAccounts[subAccountId] = {
                            id: subAccountId,
                            submissionCount: 0,
                        };
                    }
                    membersData[mainAccountId].subAccounts[subAccountId].submissionCount += 1;
                }
            }

            // 3. 각 본계정 및 타계정의 상세 정보를 가져옵니다.
            const memberList = Object.values(membersData);
            for (const member of memberList) {
                // 본계정 정보(users 컬렉션) 가져오기
                const userDoc = await getDoc(doc(db, 'users', member.id));
                if (userDoc.exists()) {
                    member.mainAccountName = userDoc.data().name;
                    member.mainAccountPhone = userDoc.data().phone;
                } else {
                    member.mainAccountName = '정보 없음';
                    member.mainAccountPhone = '정보 없음';
                }

                // 타계정 정보(subAccounts 컬렉션) 가져오기
                for (const subId in member.subAccounts) {
                    const subDoc = await getDoc(doc(db, 'subAccounts', subId));
                    if (subDoc.exists()) {
                        const subData = subDoc.data();
                        member.subAccounts[subId] = {
                            ...member.subAccounts[subId],
                            ...subData
                        };
                    }
                }
            }
            
            // 최근 참여일 순으로 정렬
            memberList.sort((a, b) => b.lastSubmissionDate.seconds - a.lastSubmissionDate.seconds);

            setMembers(memberList);
            setLoading(false);
        };

        fetchMemberData();
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

    // 정보 보기 모달 열기 핸들러
    const handleOpenModal = (member) => {
        setSelectedMember(member);
        setIsModalOpen(true);
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
                        <th>본계정 이름</th>
                        <th>본계정 전화번호</th>
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
                            <td>{member.totalSubmissions}회</td>
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