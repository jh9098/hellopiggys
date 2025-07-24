import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  auth,
  onAuthStateChanged,
  collection,
  query,
  where,
  onSnapshot,
} from '../../firebaseConfig';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatDate = (date) => {
  if (!date) return '-';
  return format(date, 'yyyy-MM-dd', { locale: ko });
};

const calcDaysLeft = (endDate) => {
  const today = new Date();
  const diff = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
  return diff;
};

export default function SellerTrafficStatusPage() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmed, setConfirmed] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setIsLoading(false);
        navigate('/seller-login');
        return;
      }
      setUser(currentUser);
      const q = query(
        collection(db, 'traffic_requests'),
        where('sellerUid', '==', currentUser.uid),
        where('status', '==', '예약 확정')
      );
      const unsub = onSnapshot(q, (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setConfirmed(arr);
        setIsLoading(false);
      });
      return () => unsub();
    });
    return () => unsubAuth();
  }, [navigate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>트래픽 현황</CardTitle>
        <CardDescription>예약 확정된 트래픽의 진행 상황을 확인합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>상품명</TableHead>
                <TableHead>개수</TableHead>
                <TableHead>잔여일자</TableHead>
                <TableHead>시작일자</TableHead>
                <TableHead>마감일자</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    로딩 중...
                  </TableCell>
                </TableRow>
              ) : confirmed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    예약 확정된 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                confirmed.map((req) => {
                  const requestDate = req.requestDate?.seconds
                    ? new Date(req.requestDate.seconds * 1000)
                    : req.requestDate
                    ? new Date(req.requestDate)
                    : null;
                  const startDate = requestDate ? new Date(requestDate.getTime() + 24 * 60 * 60 * 1000) : null;
                  const endDate = startDate ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                  const daysLeft = endDate ? calcDaysLeft(endDate) : null;
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.name}</TableCell>
                      <TableCell>{req.quantity}</TableCell>
                      <TableCell>{daysLeft ? `D-${daysLeft}` : '-'}</TableCell>
                      <TableCell>{formatDate(startDate)}</TableCell>
                      <TableCell>{formatDate(endDate)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
