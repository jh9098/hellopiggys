# backend/api_server.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import time
import urllib.parse
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup

app = Flask(__name__)
CORS(app)  # 모든 출처에서의 요청을 허용 (개발용)

def extract_vendor_item_id(url):
    match = re.search(r'vendorItemId=(\d+)', url)
    return match.group(1) if match else None

def search_coupang_rank(keyword, target_vendor_item_id):
    """
    순위 검색 로직을 별도 함수로 분리
    """
    options = uc.ChromeOptions()
    # 서버 환경에서는 headless 모드가 필수적일 수 있습니다.
    # options.add_argument('--headless=new')
    # options.add_argument('--no-sandbox')
    # options.add_argument('--disable-dev-shm-usage')
    driver = uc.Chrome(options=options, use_subprocess=True)

    rank_counter = 0
    MAX_PAGES_TO_SEARCH = 10

    try:
        for page in range(1, MAX_PAGES_TO_SEARCH + 1):
            encoded_keyword = urllib.parse.quote_plus(keyword)
            search_url = f"https://www.coupang.com/np/search?q={encoded_keyword}&channel=user&sorter=scoreDesc&listSize=60&page={page}"
            driver.get(search_url)

            try:
                WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "product-list"))
                )
            except TimeoutException:
                # 페이지 로딩 실패 시 결과 반환
                return {"status": "error", "message": f"페이지 {page} 로딩 시간 초과"}

            html = driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            products = soup.select('#product-list > li.ProductUnit_productUnit__Qd6sv')
            
            if not products:
                break

            for product in products:
                if product.select_one('.AdMark_adMark__KPMsC'):
                    continue

                rank_counter += 1
                product_id = product.get('data-id')

                if product_id == target_vendor_item_id:
                    product_name_element = product.select_one('.ProductUnit_productName__gre7e')
                    product_name = product_name_element.text.strip() if product_name_element else "상품명 없음"
                    
                    # 성공 시 결과 반환
                    return {
                        "status": "success",
                        "rank": rank_counter,
                        "page": page,
                        "productName": product_name,
                    }
            time.sleep(1.5)
            
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        driver.quit()

    # 찾지 못했을 경우
    return {"status": "not_found", "message": f"최대 {MAX_PAGES_TO_SEARCH} 페이지까지 검색했지만 상품을 찾을 수 없습니다."}

@app.route('/api/coupang-rank', methods=['POST'])
def get_coupang_rank():
    data = request.get_json()
    keyword = data.get('keyword')
    product_url = data.get('productUrl')

    if not keyword or not product_url:
        return jsonify({"status": "error", "message": "키워드와 상품 URL을 모두 입력해야 합니다."}), 400

    target_vendor_item_id = extract_vendor_item_id(product_url)
    if not target_vendor_item_id:
        return jsonify({"status": "error", "message": "유효하지 않은 상품 URL입니다."}), 400
    
    result = search_coupang_rank(keyword, target_vendor_item_id)
    return jsonify(result)

if __name__ == '__main__':
    # 개발 시에는 보통 5000번 포트를 사용합니다.
    app.run(host='0.0.0.0', port=5000, debug=True)