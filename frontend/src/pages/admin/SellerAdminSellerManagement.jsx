// src/pages/admin/SellerAdminSellerManagement.jsx

import { useState, useEffect } from 'react';
import { db, collection, onSnapshot, doc, query, where, getDocs, writeBatch } from '../../firebaseConfig';
import { Button } from '@/components/ui/button';

export default function SellerAdminSellerManagementPage() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "sellers"), (querySnapshot) => {
      const sellersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellers(sellersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteSeller = async (seller) => {
    if (!window.confirm(`정말로 '${seller.email}' 판매자를 시스템에서 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }
    
    try {
      const batch = writeBatch(db);
      const sellerRef = doc(db, 'sellers', seller.id);
      batch.delete(sellerRef);

      const campaignsQuery = query(collection(db, "campaigns"), where("sellerUid", "==", seller.id));
      const campaignsSnapshot = await getDocs(campaignsQuery);
      campaignsSnapshot.forEach(doc => batch.delete(doc.ref));
      
      const trafficQuery = query(collection(db, "traffic_requests"), where("sellerUid", "==", seller.id));
      const trafficSnapshot = await getDocs(trafficQuery);
      trafficSnapshot.forEach(doc => batch.delete(doc.ref));

      await batch.commit();

      alert(`'${seller.email}' 판매자의 Firestore 관련 데이터(캠페인, 트래픽 요청 등)가 모두 삭제되었습니다.\n\n[중요] Firebase 인증 계정은 보안 정책상 클라이언트에서 직접 삭제할 수 없으므로, Firebase Console > Authentication에서 직접 삭제해주세요.`);

    } catch (error) {
      console.error("판매자 삭제 오류:", error);
      alert(`삭제 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  return (
    <>
      <h2 className="text-3xl font-bold mb-6">판매자 관리</h2>
      <div className="bg-white p-6 rounded-lg shadow-md overflow-x-auto">
        {loading ? (
          <p>판매자 목록을 불러오는 중입니다...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['이름', '사업자번호', '이메일', '전화번호', '닉네임', '추천인ID', '예치금', '작업'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sellers.map((seller) => (
                <tr key={seller.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.name || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.businessInfo?.b_no || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.phone || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.nickname || '정보 없음'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{seller.referrerId || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(seller.deposit ?? 0).toLocaleString()}원</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <Button onClick={() => handleDeleteSeller(seller)} className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded">강제 탈퇴</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}