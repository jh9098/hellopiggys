// src/pages/AdminProductManagement.jsx
// 모바일: 결제/상품/리뷰 → "정보" 칼럼으로 합쳐 표시 (현영/실/별 등)
// 데스크톱: 기존 칼럼 유지
// 관리 버튼은 이전 답변대로 mobile-vertical 적용 가능

import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from '../firebaseConfig';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toAbsoluteUrl } from '../utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const formatDate = (date) => date ? new Date(date.seconds * 1000).toLocaleDateString() : 'N/A';

const progressStatusOptions = ['진행전', '진행중', '진행완료', '일부완료', '보류'];

const productTypeOptionsFull = [
  { value: '실배송', desktop: '실배송', mobile: '실' },
  { value: '빈박스', desktop: '빈박스', mobile: '빈' },
];

const reviewTypeOptionsFull = [
  { value: '현영', desktop: '현영', mobile: '현영' },
  { value: '자율결제', desktop: '자율결제', mobile: '자율' },
];

const fullReviewOptionsFull = [
  { value: '별점', desktop: '별점', mobile: '별' },
  { value: '텍스트', desktop: '텍스트', mobile: '텍' },
  { value: '포토', desktop: '포토', mobile: '포토' },
  { value: '프리미엄(포토)', desktop: '프리미엄(포토)', mobile: '프포' },
  { value: '프리미엄(영상)', desktop: '프리미엄(영상)', mobile: '프영' },
];

const limitedReviewOptionsFull = [
  { value: '별점', desktop: '별점', mobile: '별' },
  { value: '텍스트', desktop: '텍스트', mobile: '텍' },
];

const MOBILE_ABBR = {
  reviewType: { '현영': '현영', '자율결제': '자율' },
  productType: { '실배송': '실', '빈박스': '빈' },
  reviewOption: {
    '별점': '별', '텍스트': '텍', '포토': '포토',
    '프리미엄(포토)': '프포', '프리미엄(영상)': '프영'
  }
};

const REVIEW_LINK_BASE_URL = 'https://hellopiggys.netlify.app/reviewer/link?pid=';

export default function AdminProductManagementPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    productName: '', reviewType: '', reviewDate: '', progressStatus: 'all',
    productType: '', reviewOption: '',
  });

  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkReviewType, setBulkReviewType] = useState('');
  const [bulkProductType, setBulkProductType] = useState('');
  const [bulkReviewOption, setBulkReviewOption] = useState('');
  const [bulkProgressStatus, setBulkProgressStatus] = useState('');
  const [vatMap, setVatMap] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageGroup, setPageGroup] = useState(0);

  const [isMobile, setIsMobile] = useState(false);

  const itemsPerPage = 20;
  const pagesPerGroup = 10;
  const navigate = useNavigate();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    const todayKST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
    const productsData = snapshot.docs.map(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      return data;
    });

    // 진행 상태 자동 업데이트
    const updates = [];
    productsData.forEach(p => {
      if ((p.progressStatus === '진행전' || !p.progressStatus) && p.reviewDate === todayKST) {
        updates.push(updateDoc(doc(db, 'products', p.id), { progressStatus: '진행중' }));
        p.progressStatus = '진행중';
      }
    });
    if (updates.length > 0) await Promise.all(updates);

    // VAT 맵
    const vatSnapshot = await getDocs(collection(db, 'campaigns'));
    const map = {};
    vatSnapshot.forEach(d => {
      const data = d.data();
      if (data.productId) map[data.productId] = data.isVatApplied;
    });

    setVatMap(map);
    setProducts(productsData);
    setLoading(false);
  };

  useEffect(() => { fetchProducts(); }, []);

  const processedProducts = useMemo(() => {
    let filtered = [...products];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || value === 'all') return;
      filtered = filtered.filter(p => p[key]?.toString().toLowerCase().includes(value.toLowerCase()));
    });
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [products, filters, sortConfig]);

  // groupMap for checkbox grouping
  const groupMap = useMemo(() => {
    const map = {};
    processedProducts.forEach(p => {
      const key = p.createdAt?.seconds || p.id;
      if (!map[key]) map[key] = [];
      map[key].push(p.id);
    });
    return map;
  }, [processedProducts]);

  // pagination with group rowSpan
  const groupedAndPaginatedProducts = useMemo(() => {
    const groups = [];
    processedProducts.forEach(p => {
      const key = p.createdAt?.seconds || p.id;
      let group = groups.find(g => g.key === key);
      if (!group) {
        group = { key, items: [] };
        groups.push(group);
      }
      group.items.push(p);
    });

    const flattened = [];
    let counter = 1;
    groups.forEach(g => {
      g.items.forEach((item, idx) => {
        flattened.push({
          ...item,
          groupInfo: {
            id: g.key,
            size: g.items.length,
            isFirstInGroup: idx === 0,
            displayIndex: counter,
          },
        });
      });
      counter++;
    });

    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginated = flattened.slice(startIndex, startIndex + itemsPerPage);

    const finalItems = [];
    const seen = new Set();
    paginated.forEach(item => {
      const groupId = item.groupInfo.id;
      let rowSpan = 0;
      let shouldRender = false;
      if (!seen.has(groupId)) {
        seen.add(groupId);
        shouldRender = true;
        rowSpan = paginated.filter(i => i.groupInfo.id === groupId).length;
      }
      finalItems.push({
        ...item,
        renderInfo: { shouldRender, rowSpan },
      });
    });

    return finalItems;
  }, [processedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(processedProducts.length / itemsPerPage);
  useEffect(() => {
    const group = Math.floor((currentPage - 1) / pagesPerGroup);
    if (group !== pageGroup) setPageGroup(group);
  }, [currentPage, pageGroup]);

  const goToPage = (page) => { if (page > 0 && page <= totalPages) setCurrentPage(page); };
  const prevGroup = () => setPageGroup(g => Math.max(0, g - 1));
  const nextGroup = () => setPageGroup(g => (g + 1) * pagesPerGroup < totalPages ? g + 1 : g);

  const handleDelete = async (id) => {
    if (window.confirm('정말로 이 상품을 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'products', id));
      alert('상품이 삭제되었습니다.');
      fetchProducts();
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const resetFilters = () => setFilters({
    productName: '', reviewType: '', reviewDate: '', progressStatus: 'all',
    productType: '', reviewOption: '',
  });

  const downloadCsv = () => {
    const csvData = processedProducts.map(p => ({
      '상품명': p.productName || '-',
      '결제 종류': p.reviewType || '-',
      '상품 종류': p.productType || '-',
      '리뷰 종류': p.reviewOption || '-',
      '체험단 개수': p.quantity || '-',
      '옵션': p.productOption || '-',
      '상품가': p.productPrice || '-',
      '키워드': p.keywords || '-',
      '상품 URL': p.productUrl || '-',
      '진행일자': p.reviewDate || '-',
      '진행 상태': p.progressStatus || '-',
      '등록날짜': formatDate(p.createdAt),
    }));
    const csv = Papa.unparse(csvData, { header: true });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await updateDoc(doc(db, 'products', id), { progressStatus: newStatus });
      setProducts(prev => prev.map(p => (p.id === id ? { ...p, progressStatus: newStatus } : p)));
    } catch (error) {
      alert('상태 변경 중 오류가 발생했습니다: ' + error.message);
    }
  };

  const handleFieldChange = async (id, field, value) => {
    try {
      await updateDoc(doc(db, 'products', id), { [field]: value });
      setProducts(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
    } catch (err) {
      alert('정보 수정 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(groupedAndPaginatedProducts.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleSelectGroup = (groupId, checked) => {
    const ids = groupMap[groupId] || [];
    if (checked) {
      setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm('선택한 상품을 모두 삭제하시겠습니까?')) return;
    for (const id of selectedIds) {
      await deleteDoc(doc(db, 'products', id));
    }
    setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
    setSelectedIds([]);
  };

  const bulkUpdate = async (field, value) => {
    if (!value || selectedIds.length === 0) return;
    const updates = selectedIds.map(id => updateDoc(doc(db, 'products', id), { [field]: value }));
    await Promise.all(updates);
    setProducts(prev => prev.map(p => selectedIds.includes(p.id) ? { ...p, [field]: value } : p));
  };

  const handleCopyGuide = (guideText, pid) => {
    if (!guideText) {
      alert('복사할 가이드 내용이 없습니다.');
      return;
    }
    const link = REVIEW_LINK_BASE_URL + pid;
    const textToCopy = `${link}\n\n${guideText}`;
    navigator.clipboard.writeText(textToCopy)
      .then(() => alert('가이드가 복사되었습니다!'))
      .catch(err => {
        alert('가이드 복사에 실패했습니다.');
        console.error('Could not copy text: ', err);
      });
  };

  if (loading) return <p>상품 목록을 불러오는 중...</p>;

  const SortIndicator = ({ columnKey }) =>
    sortConfig.key !== columnKey ? null : (sortConfig.direction === 'asc' ? ' ▲' : ' ▼');

  const renderOptions = (arr) =>
    arr.map(o => <option key={o.value} value={o.value}>{isMobile ? o.mobile : o.desktop}</option>);

  const buildInfoString = (p) => {
    const rt = MOBILE_ABBR.reviewType[p.reviewType] || p.reviewType || '';
    const pt = MOBILE_ABBR.productType[p.productType] || p.productType || '';
    const ro = MOBILE_ABBR.reviewOption[p.reviewOption] || p.reviewOption || '';
    return [rt, pt, ro].filter(Boolean).join('/');
  };

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>상품 관리 ({processedProducts.length})</h2>
        <Button asChild>
          <Link to="/admin/products/new">상품 생성</Link>
        </Button>
      </div>

      <div className="toolbar">
        <Button variant="outline" size="sm" onClick={resetFilters}>필터 초기화</Button>
        <Button variant="outline" size="sm" onClick={downloadCsv}>엑셀 다운로드</Button>
      </div>

      <div className="toolbar">
        <Button variant="destructive" size="sm" onClick={deleteSelected}>선택 삭제</Button>
      </div>

      <div className="table-container">
        <Table className="admin-table">
          <TableHeader>
            <TableRow>
              {/* 체크박스 - 모바일 숨김 */}
              <TableHead className="hide-mobile">
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={groupedAndPaginatedProducts.length > 0 &&
                           groupedAndPaginatedProducts.every(p => selectedIds.includes(p.id))}
                />
              </TableHead>

              {/* 상품군 / 발행여부 - 모바일 숨김 */}
              <TableHead className="hide-mobile">상품군</TableHead>
              <TableHead className="hide-mobile">발행여부</TableHead>

              {/* 상품명 - 공통 */}
              <TableHead onClick={() => requestSort('productName')} className="sortable">
                상품명<SortIndicator columnKey="productName" />
              </TableHead>

              {/* 모바일: 정보(결제/상품/리뷰 요약), 데스크톱: 개별 칼럼 */}
              {isMobile ? (
                <TableHead>정보</TableHead>
              ) : (
                <>
                  <TableHead onClick={() => requestSort('reviewType')} className="sortable">
                    결제 종류<SortIndicator columnKey="reviewType" />
                  </TableHead>
                  <TableHead onClick={() => requestSort('productType')} className="sortable">
                    상품 종류<SortIndicator columnKey="productType" />
                  </TableHead>
                  <TableHead onClick={() => requestSort('reviewOption')} className="sortable">
                    리뷰 종류<SortIndicator columnKey="reviewOption" />
                  </TableHead>
                </>
              )}

              {/* 숨김 컬럼들 */}
              <TableHead className="hide-mobile">체험단 개수</TableHead>
              <TableHead className="hide-mobile">옵션</TableHead>
              <TableHead className="hide-mobile">상품가</TableHead>
              <TableHead className="hide-mobile">키워드</TableHead>
              <TableHead className="hide-mobile">상품 URL</TableHead>
              <TableHead className="sortable hide-mobile" onClick={() => requestSort('reviewDate')}>
                진행일자<SortIndicator columnKey="reviewDate" />
              </TableHead>

              {/* 진행상태 - 공통 */}
              <TableHead onClick={() => requestSort('progressStatus')} className="sortable">
                진행상태<SortIndicator columnKey="progressStatus" />
              </TableHead>

              {/* 등록날짜 - 모바일 숨김 */}
              <TableHead className="sortable hide-mobile" onClick={() => requestSort('createdAt')}>
                등록날짜<SortIndicator columnKey="createdAt" />
              </TableHead>

              {/* 관리 - 공통 */}
              <TableHead>관리</TableHead>
            </TableRow>

            {/* 일괄 변경 - 모바일 숨김 */}
            <TableRow className="bulk-row hide-mobile">
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkReviewType} onChange={(e) => setBulkReviewType(e.target.value)}>
                    <option value="">결제 종류 일괄 변경</option>
                    {reviewTypeOptionsFull.map(o => <option key={o.value} value={o.value}>{o.desktop}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('reviewType', bulkReviewType); setBulkReviewType(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkProductType} onChange={(e) => setBulkProductType(e.target.value)}>
                    <option value="">상품 종류 일괄 변경</option>
                    {productTypeOptionsFull.map(o => <option key={o.value} value={o.value}>{o.desktop}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('productType', bulkProductType); setBulkProductType(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkReviewOption} onChange={(e) => setBulkReviewOption(e.target.value)}>
                    <option value="">리뷰 종류 일괄 변경</option>
                    {fullReviewOptionsFull.map(o => <option key={o.value} value={o.value}>{o.desktop}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('reviewOption', bulkReviewOption); setBulkReviewOption(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead>
                <div className="bulk-control">
                  <select value={bulkProgressStatus} onChange={(e) => setBulkProgressStatus(e.target.value)}>
                    <option value="">진행 상태 일괄 변경</option>
                    {progressStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <Button size="sm" onClick={() => { bulkUpdate('progressStatus', bulkProgressStatus); setBulkProgressStatus(''); }}>적용</Button>
                </div>
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>

            {/* 필터 행 - 모바일 숨김 */}
            <TableRow className="filter-row hide-mobile">
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead><Input type="text" name="productName" value={filters.productName} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="reviewType" value={filters.reviewType} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="productType" value={filters.productType} onChange={handleFilterChange} /></TableHead>
              <TableHead><Input type="text" name="reviewOption" value={filters.reviewOption} onChange={handleFilterChange} /></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
              <TableHead><Input type="text" name="reviewDate" value={filters.reviewDate} onChange={handleFilterChange} /></TableHead>
              <TableHead>
                <select name="progressStatus" value={filters.progressStatus} onChange={handleFilterChange}>
                  <option value="all">전체</option>
                  {progressStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </TableHead>
              <TableHead></TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {processedProducts.length > 0 ? (
              groupedAndPaginatedProducts.map(p => {
                const reviewOptionsArray = p.productType === '빈박스'
                  ? limitedReviewOptionsFull
                  : fullReviewOptionsFull;

                return (
                  <TableRow key={p.id}>
                    {/* 체크박스 - 모바일 숨김 */}
                    <TableCell className="hide-mobile">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => handleSelectOne(p.id)}
                      />
                    </TableCell>

                    {/* 상품군 / 발행여부 - 모바일 숨김 */}
                    {p.renderInfo.shouldRender && (
                      <TableCell rowSpan={p.renderInfo.rowSpan} className="text-center align-middle font-semibold hide-mobile">
                        <label className="flex items-center justify-center space-x-1">
                          <input
                            type="checkbox"
                            onChange={(e) => handleSelectGroup(p.groupInfo.id, e.target.checked)}
                            checked={(groupMap[p.groupInfo.id] || []).every(id => selectedIds.includes(id))}
                          />
                          <span>{`상품군 ${p.groupInfo.displayIndex}`}</span>
                        </label>
                      </TableCell>
                    )}
                    {p.renderInfo.shouldRender && (
                      <TableCell rowSpan={p.renderInfo.rowSpan} className="text-center align-middle hide-mobile">
                        {(vatMap[p.id] ?? p.isVatApplied) ? '세금계산서 발행' : '세금계산서 미발행'}
                      </TableCell>
                    )}

                    {/* 상품명 */}
                    <TableCell style={{ textAlign: 'left' }}>{p.productName}</TableCell>

                    {/* 모바일: 정보 문자열, 데스크톱: 각 셀 + select */}
                    {isMobile ? (
                      <TableCell className="info-cell">{buildInfoString(p)}</TableCell>
                    ) : (
                      <>
                        <TableCell>
                          <select
                            value={p.reviewType || '현영'}
                            onChange={(e) => handleFieldChange(p.id, 'reviewType', e.target.value)}
                          >
                            {renderOptions(reviewTypeOptionsFull)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            value={p.productType || '실배송'}
                            onChange={(e) => handleFieldChange(p.id, 'productType', e.target.value)}
                          >
                            {renderOptions(productTypeOptionsFull)}
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            value={p.reviewOption || '별점'}
                            onChange={(e) => handleFieldChange(p.id, 'reviewOption', e.target.value)}
                          >
                            {renderOptions(reviewOptionsArray)}
                          </select>
                        </TableCell>
                      </>
                    )}

                    {/* 숨김 칼럼들 */}
                    <TableCell className="hide-mobile">{p.quantity}</TableCell>
                    <TableCell className="hide-mobile">{p.productOption}</TableCell>
                    <TableCell className="hide-mobile">
                      {p.productPrice ? Number(p.productPrice).toLocaleString() + '원' : ''}
                    </TableCell>
                    <TableCell className="hide-mobile">{p.keywords}</TableCell>
                    <TableCell className="hide-mobile">
                      {p.productUrl ? (
                        <a href={toAbsoluteUrl(p.productUrl)} target="_blank" rel="noopener noreferrer">링크</a>
                      ) : ''}
                    </TableCell>
                    <TableCell className="hide-mobile">{p.reviewDate}</TableCell>

                    {/* 진행상태 - 공통 */}
                    <TableCell>
                      <select
                        value={p.progressStatus || '진행전'}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                      >
                        <option value="">선택</option>
                        {progressStatusOptions.map(s => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </TableCell>

                    {/* 등록날짜 - 모바일 숨김 */}
                    <TableCell className="hide-mobile">{formatDate(p.createdAt)}</TableCell>

                    {/* 관리 */}
                    <TableCell className={`actions-cell ${isMobile ? 'mobile-vertical' : ''}`}>
                      <Button size="sm" className="table-edit-btn" onClick={() => navigate(`/admin/products/edit/${p.id}`)}>수정</Button>
                      <Button size="sm" className="table-copy-btn" onClick={() => handleCopyGuide(p.guide, p.id)}>가이드복사</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id)} className="table-delete-btn">삭제</Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan="16" style={{ padding: '50px', textAlign: 'center' }}>
                  생성된 상품이 없습니다.
                </TableCell>
              </TableRow>
            )}
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
    </>
  );
}
