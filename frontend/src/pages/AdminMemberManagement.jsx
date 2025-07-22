// src/pages/AdminMemberManagement.jsx

import { useState, useEffect, useMemo } from 'react';
import { db, collection, getDocs, query, orderBy, doc, where, writeBatch, documentId } from '../firebaseConfig';
import MemberDetailModal from '../components/MemberDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate();
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
};

export default function AdminMemberManagementPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageGroup, setPageGroup] = useState(0);
    const itemsPerPage = 10;
    const pagesPerGroup = 10;

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
            const reviews = reviewsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            const membersData = {};
            const mainAccountIds = new Set();
            const subAccountIds = new Set();

            for (const review of reviews) {
                const { mainAccountId, subAccountId } = review;
                if (!mainAccountId) continue;

                mainAccountIds.add(mainAccountId);
                if (subAccountId) subAccountIds.add(subAccountId);

                if (!membersData[mainAccountId]) {
                    membersData[mainAccountId] = {
                        id: mainAccountId,
                        lastSubmissionDate: null,
                        reviews: [],
                    };
                }
                membersData[mainAccountId].reviews.push(review);

                if (!membersData[mainAccountId].lastSubmissionDate || review.createdAt.seconds > membersData[mainAccountId].lastSubmissionDate.seconds) {
                    membersData[mainAccountId].lastSubmissionDate = review.createdAt;
                }
            }

            const fetchDocsByIds = async (col, ids) => {
                const result = {};
                const arr = Array.from(ids);
                for (let i = 0; i < arr.length; i += 10) {
                    const chunk = arr.slice(i, i + 10);
                    const q = query(collection(db, col), where(documentId(), 'in', chunk));
                    const snap = await getDocs(q);
                    snap.forEach(d => { result[d.id] = d.data(); });
                }
                return result;
            };

            const [userMap, subMap] = await Promise.all([
                fetchDocsByIds('users', mainAccountIds),
                fetchDocsByIds('subAccounts', subAccountIds)
            ]);

            const memberList = Object.values(membersData);
            memberList.forEach(member => {
                const user = userMap[member.id];
                member.mainAccountName = user?.name ?? '정보 없음';
                member.mainAccountPhone = user?.phone ?? '정보 없음';

                member.reviews.forEach(review => {
                    if (review.subAccountId) {
                        review.subAccountInfo = subMap[review.subAccountId] || { name: '삭제된 계정' };
                    }
                });
                member.reviewCount = member.reviews.length;
            });

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
                let valA, valB;
                if (sortConfig.key === 'reviewCount') {
                    valA = a.reviews.length;
                    valB = b.reviews.length;
                } else {
                    valA = a[sortConfig.key] || '';
                    valB = b[sortConfig.key] || '';
                }
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
    useEffect(() => {
        const group = Math.floor((currentPage - 1) / pagesPerGroup);
        if (group !== pageGroup) setPageGroup(group);
    }, [currentPage, pageGroup]);
    const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
    const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);
    const requestSort = (key) => {
        let direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
        setSortConfig({ key, direction });
    };

    const SortIndicator = ({ columnKey }) => sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');
    const handleOpenModal = (member) => { setSelectedMember(member); setIsModalOpen(true); };

    const handleDeleteMember = async (member) => {
        if (!window.confirm(`정말로 '${member.mainAccountName || ''}' 회원을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'users', member.id));
            if (member.mainAccountPhone) {
                batch.delete(doc(db, 'users_by_phone', member.mainAccountPhone));
            }
            const subSnap = await getDocs(query(collection(db, 'subAccounts'), where('mainAccountId', '==', member.id)));
            subSnap.forEach(d => batch.delete(d.ref));
            const addrSnap = await getDocs(query(collection(db, 'addresses'), where('mainAccountId', '==', member.id)));
            addrSnap.forEach(d => batch.delete(d.ref));
            const reviewSnap = await getDocs(query(collection(db, 'reviews'), where('mainAccountId', '==', member.id)));
            reviewSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            alert('회원 관련 데이터가 삭제되었습니다. Firebase Authentication 계정은 콘솔에서 별도로 삭제해주세요.');
            setMembers(prev => prev.filter(m => m.id !== member.id));
        } catch (err) {
            console.error('회원 삭제 오류:', err);
            alert('회원 삭제 중 오류가 발생했습니다: ' + err.message);
        }
    };

    if (loading) return <p>회원 정보를 불러오는 중...</p>;

    return (
        <>
            <h2>회원 관리 ({processedMembers.length}명)</h2>
            <div className="toolbar">
                <Input type="text" placeholder="이름 검색" value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                <Input type="text" placeholder="전화번호 검색" value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
            </div>
            <div className="table-container">
                <Table className="admin-table">
                    <TableHeader>
                        <TableRow>
                            <TableHead onClick={() => requestSort('mainAccountName')} className="sortable">본계정 이름<SortIndicator columnKey="mainAccountName" /></TableHead>
                            <TableHead onClick={() => requestSort('mainAccountPhone')} className="sortable">본계정 전화번호<SortIndicator columnKey="mainAccountPhone" /></TableHead>
                            <TableHead onClick={() => requestSort('reviewCount')} className="sortable">총 참여횟수<SortIndicator columnKey="reviewCount" /></TableHead>
                            <TableHead>최근 참여일</TableHead>
                            <TableHead>정보 보기</TableHead>
                            <TableHead>회원 탈퇴</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedMembers.map(member => (
                            <TableRow key={member.id}>
                                <TableCell>{member.mainAccountName}</TableCell>
                                <TableCell>{member.mainAccountPhone}</TableCell>
                                <TableCell>{member.reviews.length}회</TableCell>
                                <TableCell>{formatDate(member.lastSubmissionDate)}</TableCell>
                                <TableCell><Button variant="outline" size="sm" onClick={() => handleOpenModal(member)}>보기</Button></TableCell>
                                <TableCell><Button variant="destructive" size="sm" onClick={() => handleDeleteMember(member)}>탈퇴</Button></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="pagination">
                <Button variant="outline" size="sm" onClick={prevGroup} disabled={pageGroup === 0}>{'<<'}</Button>
                <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>{'<'}</Button>
                {Array.from({ length: Math.min(pagesPerGroup, totalPages - pageGroup * pagesPerGroup) }, (_, i) => {
                    const pageNum = pageGroup * pagesPerGroup + i + 1;
                    return (
                        <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                        >
                            {pageNum}
                        </Button>
                    );
                })}
                <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>{'>'}</Button>
                <Button variant="outline" size="sm" onClick={nextGroup} disabled={(pageGroup + 1) * pagesPerGroup >= totalPages}>{'>>'}</Button>
            </div>
            {isModalOpen && (
                <MemberDetailModal
                    member={selectedMember}
                    onClose={() => setIsModalOpen(false)}
                    onDelete={handleDeleteMember}
                />
            )}
        </>
    );
}