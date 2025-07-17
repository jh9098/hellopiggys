import { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { ko } from 'date-fns/locale';
import { db, doc, getDoc, setDoc } from '../../firebaseConfig';

const DEFAULT_PRODUCT = { category: '', name: '', description: '', retailPrice: 0, discountRate: 0 };

export default function SellerAdminTrafficPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const snap = await getDoc(doc(db, 'config', 'traffic_products'));
      if (snap.exists()) {
        const data = snap.data().products || [];
        setProducts(data.map(p => ({
          ...p,
          salePrice: Math.round(p.retailPrice * (1 - p.discountRate)),
          quantity: 0,
          requestDate: null,
        })));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleEdit = (index, field, value) => {
    const newProducts = [...products];
    if (field === 'retailPrice' || field === 'discountRate') {
      newProducts[index][field] = Number(value);
      newProducts[index].salePrice = Math.round(newProducts[index].retailPrice * (1 - newProducts[index].discountRate));
    } else {
      newProducts[index][field] = value;
    }
    setProducts(newProducts);
  };

  const handleInputChange = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = field === 'quantity' ? Math.max(0, Number(value)) : value;
    setProducts(newProducts);
  };


  const quoteTotal = products.reduce((sum, p) => sum + (p.salePrice * p.quantity), 0);
  const totalCommission = Math.round(quoteTotal * 0.1);
  const totalAmount = quoteTotal + totalCommission;

  const thClass = "px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 border-b border-r border-gray-200";
  const tdClass = "px-4 py-3 whitespace-nowrap text-sm text-gray-800 border-b border-r border-gray-200";
  const inputClass = "w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-center";

  const addRow = () => {
    setProducts(prev => [...prev, { ...DEFAULT_PRODUCT, salePrice: 0, quantity: 0, requestDate: null }]);
  };

  const saveProducts = async () => {
    const plain = products.map(p => {
      const { salePrice, quantity, requestDate, ...rest } = p;
      return rest;
    });
    await setDoc(doc(db, 'config', 'traffic_products'), { products: plain });
    alert('저장되었습니다.');
  };

  if (loading) return <p>로딩 중...</p>;

  return (
    <>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">트래픽 요청서 (관리자)</h1>
      <div className="mb-8 p-4 bg-blue-50 border-l-4 border-blue-400 text-gray-700 rounded-r-lg">
        <ul className="list-disc list-inside space-y-2 text-sm">
          <li>원하는 상품의 구매 개수와 요청일자를 입력하세요.</li>
        </ul>
      </div>
      <div className="bg-white rounded-xl shadow-lg mb-8">
          <h2 className="text-2xl font-bold mb-4 text-gray-700 p-6">트래픽 견적요청 (스프레드시트)</h2>
          <div className="overflow-x-auto">
              <table className="min-w-full">
                  <thead>
                    <tr>
                      <th className={`${thClass} w-40`}>구분</th>
                      <th className={thClass}>상품명</th>
                      <th className={thClass}>설명</th>
                      <th className={`${thClass} w-48`}>가격</th>
                      <th className={`${thClass} w-28`}>구매 개수</th>
                      <th className={`${thClass} w-40`}>요청일자</th>
                      <th className={`${thClass} w-32`}>시작일자</th>
                      <th className={`${thClass} w-32`}>종료일자</th>
                      <th className={`${thClass} w-36 border-r-0`}>트래픽 견적</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                  {products.map((p, index) => {
                      const startDate = p.requestDate ? new Date(p.requestDate.getTime() + 24 * 60 * 60 * 1000) : null;
                      const endDate = startDate ? new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
                      const estimate = p.salePrice * p.quantity;
                      return (
                      <tr key={index}>
                          <td className={`${tdClass} align-middle text-center font-bold bg-gray-50`}>
                              <input type="text" value={p.category} onChange={e => handleEdit(index, 'category', e.target.value)} className={inputClass} />
                          </td>
                          <td className={`${tdClass} font-semibold`}>
                            <input type="text" value={p.name} onChange={e => handleEdit(index, 'name', e.target.value)} className={inputClass} />
                          </td>
                          <td className={tdClass}>
                            <input type="text" value={p.description} onChange={e => handleEdit(index, 'description', e.target.value)} className={inputClass} />
                          </td>
                          <td className={`${tdClass} text-xs`}>
                            <div className="flex flex-col space-y-1">
                              <input type="number" value={p.retailPrice} onChange={e => handleEdit(index, 'retailPrice', e.target.value)} className={inputClass} />
                              <input type="number" value={p.discountRate} onChange={e => handleEdit(index, 'discountRate', e.target.value)} step="0.01" className={inputClass} />
                              <span className="text-red-600">할인율: {Math.round(p.discountRate * 100)}%</span>
                              <span className="font-bold text-blue-600 text-sm">판매가: {p.salePrice.toLocaleString()}원</span>
                            </div>
                          </td>
                          <td className={tdClass}>
                            <input type="number" value={p.quantity} onChange={(e) => handleInputChange(index, 'quantity', e.target.value)} className={inputClass} min="0"/>
                          </td>
                          <td className={tdClass}>
                            <DatePicker selected={p.requestDate} onChange={(date) => handleInputChange(index, 'requestDate', date)} className={inputClass} dateFormat="yyyy/MM/dd" locale={ko} placeholderText="날짜 선택"/>
                          </td>
                          <td className={tdClass}>{startDate ? startDate.toLocaleDateString() : '-'}</td>
                          <td className={tdClass}>{endDate ? endDate.toLocaleDateString() : '-'}</td>
                          <td className={`${tdClass} font-bold text-lg text-green-600 border-r-0`}>{estimate.toLocaleString()}원</td>
                      </tr>);
                  })}
                  </tbody>
              </table>
          </div>
          <div className="mt-6 p-6 border-t border-gray-200 text-right">
              <div className="space-y-2 mb-4 text-gray-700">
                <p className="text-md">견적 합계: <span className="font-semibold">{quoteTotal.toLocaleString()}</span> 원</p>
                <p className="text-md">세금계산서 (10%): <span className="font-semibold">{totalCommission.toLocaleString()}</span> 원</p>
                <p className="text-lg font-bold">총 결제 금액: <span className="font-bold text-blue-600">{totalAmount.toLocaleString()}</span> 원</p>
              </div>
              <div className="space-x-2">
                <button onClick={addRow} className="bg-gray-200 px-4 py-2 rounded">행 추가</button>
                <button onClick={saveProducts} className="bg-blue-600 text-white px-4 py-2 rounded">저장</button>
              </div>
          </div>
      </div>
    </>
  );
}
