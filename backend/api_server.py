# backend/api_server.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import time
import random
import urllib.parse
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from bs4 import BeautifulSoup
import os

app = Flask(__name__)
CORS(app)

# --- [★수정★] 구해오신 프록시 정보를 여기에 입력하세요 ---
PROXY_IP = "123.141.181.49"
PROXY_PORT = "5031"
# 사용자 이름과 비밀번호가 없으므로 해당 변수는 삭제합니다.

def extract_vendor_item_id(url):
    match = re.search(r'vendorItemId=(\d+)', url)
    return match.group(1) if match else None

def search_coupang_rank(keyword, target_vendor_item_id):
    driver = None
    try:
        options = uc.ChromeOptions()
        
        # --- [★수정★] 프록시 설정 방식 변경 ---
        # 인증이 없는 프록시는 '--proxy-server' 옵션으로 간단하게 설정 가능
        if PROXY_IP and PROXY_PORT:
            proxy_server_url = f"http://{PROXY_IP}:{PROXY_PORT}"
            options.add_argument(f'--proxy-server={proxy_server_url}')
            print(f"--- 프록시 서버 설정: {proxy_server_url} ---")
        else:
            print("--- 프록시 정보가 없습니다. 프록시 없이 실행합니다. ---")
        # ------------------------------------

        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
        driver = uc.Chrome(
            headless=True,
            options=options,
        )
        
        # ... (이하 스크래핑 로직은 모두 동일)
        rank_counter = 0
        MAX_PAGES_TO_SEARCH = 10

        for page in range(1, MAX_PAGES_TO_SEARCH + 1):
            encoded_keyword = urllib.parse.quote_plus(keyword)
            search_url = f"https://www.coupang.com/np/search?q={encoded_keyword}&channel=user&sorter=scoreDesc&listSize=60&page={page}"
            
            print(f"Navigating to page {page}: {search_url}")
            driver.get(search_url)

            try:
                WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "product-list")))
            except TimeoutException:
                print("TimeoutException: 'product-list' not found.")
                return {"status": "error", "message": f"페이지 {page} 로딩에 실패했거나 프록시 연결에 실패했습니다."}

            time.sleep(random.uniform(0.5, 1.0))
            
            html = driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            products = soup.select('#product-list > li.ProductUnit_productUnit__Qd6sv')
            
            if not products:
                print(f"Page {page}: No products found.")
                if "로봇이 아닙니다" in html or "Captcha" in driver.title:
                     return {"status": "error", "message": "캡챠(로봇 확인) 페이지에 막혔습니다."}
                break

            for product in products:
                if product.select_one('.AdMark_adMark__KPMsC'): continue
                rank_counter += 1
                product_id = product.get('data-id')

                if product_id == target_vendor_item_id:
                    product_name_element = product.select_one('.ProductUnit_productName__gre7e')
                    product_name = product_name_element.text.strip() if product_name_element else "상품명 없음"
                    return {"status": "success", "rank": rank_counter, "page": page, "productName": product_name}
            
            time.sleep(random.uniform(1.0, 2.5))
            
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return {"status": "error", "message": f"스크래핑 중 오류 발생: {e}."}
    finally:
        if driver:
            driver.quit()

    return {"status": "not_found", "message": f"최대 {MAX_PAGES_TO_SEARCH} 페이지까지 검색했지만 상품을 찾지 못했습니다."}

# ... 이하 @app.route('/api/coupang-rank') 부분은 모두 동일 ...
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
    app.run(host='0.0.0.0', port=5000, debug=True)