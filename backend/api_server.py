# backend/api_server.py (최종 완성본 - 유료 인증 프록시용)

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

# --- [★중요★] 발급받은 유료 프록시 정보로 교체하세요 ---
PROXY_HOST = "your_paid_proxy_host"  # 예: kr.smartproxy.com
PROXY_PORT = "your_paid_proxy_port"  # 예: 10000
PROXY_USER = "your_paid_proxy_username"
PROXY_PASS = "your_paid_proxy_password"

def get_proxy_extension_options():
    """인증 프록시를 위한 Chrome 확장 프로그램을 동적으로 생성합니다."""
    if PROXY_HOST == "your_paid_proxy_host":
        print("--- 경고: 유료 프록시 정보가 설정되지 않았습니다. ---")
        return None

    manifest_json = """
    { "version": "1.0.0", "manifest_version": 2, "name": "Chrome Proxy",
      "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
      "background": {"scripts": ["background.js"]} }
    """
    background_js = """
    var config = {
        mode: "fixed_servers",
        rules: { singleProxy: { scheme: "http", host: "%s", port: parseInt(%s) }, bypassList: ["localhost"] }
    };
    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
    function callbackFn(details) {
        return { authCredentials: { username: "%s", password: "%s" } };
    }
    chrome.webRequest.onAuthRequired.addListener( callbackFn, {urls: ["<all_urls>"]}, ['blocking']);
    """ % (PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS)
    
    # Render의 임시 파일 시스템에 확장 프로그램 파일 생성
    plugin_dir = '/tmp/proxy_auth_plugin'
    if not os.path.exists(plugin_dir):
        os.makedirs(plugin_dir)

    with open(os.path.join(plugin_dir, 'manifest.json'), 'w') as f:
        f.write(manifest_json)
    with open(os.path.join(plugin_dir, 'background.js'), 'w') as f:
        f.write(background_js)
        
    return f'--load-extension={plugin_dir}'

def extract_vendor_item_id(url):
    match = re.search(r'vendorItemId=(\d+)', url)
    return match.group(1) if match else None

def search_coupang_rank(keyword, target_vendor_item_id):
    driver = None
    try:
        options = uc.ChromeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")

        proxy_option = get_proxy_extension_options()
        if proxy_option:
            options.add_argument(proxy_option)
            print(f"--- 인증 프록시({PROXY_HOST}) 설정 완료 ---")
        
        driver = uc.Chrome(headless=True, options=options)
        
        # ... (이하 스크래핑 로직은 동일) ...
        rank_counter = 0
        MAX_PAGES_TO_SEARCH = 10
        for page in range(1, MAX_PAGES_TO_SEARCH + 1):
            encoded_keyword = urllib.parse.quote_plus(keyword)
            search_url = f"https://www.coupang.com/np/search?q={encoded_keyword}&channel=user&sorter=scoreDesc&listSize=60&page={page}"
            driver.get(search_url)
            WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.ID, "product-list")))
            html = driver.page_source
            soup = BeautifulSoup(html, 'html.parser')
            products = soup.select('#product-list > li.ProductUnit_productUnit__Qd6sv')
            if not products: break
            for product in products:
                if product.select_one('.AdMark_adMark__KPMsC'): continue
                rank_counter += 1
                product_id = product.get('data-id')
                if product_id == target_vendor_item_id:
                    product_name = product.select_one('.ProductUnit_productName__gre7e').text.strip()
                    return {"status": "success", "rank": rank_counter, "page": page, "productName": product_name}
            time.sleep(random.uniform(1.0, 2.5))
            
    except Exception as e:
        return {"status": "error", "message": f"스크래핑 중 오류 발생: {e}."}
    finally:
        if driver: driver.quit()

    return {"status": "not_found", "message": f"최대 {MAX_PAGES_TO_SEARCH} 페이지까지 검색했지만 상품을 찾지 못했습니다."}

# ... (이하 @app.route 부분은 동일) ...
@app.route('/api/coupang-rank', methods=['POST'])
def get_coupang_rank():
    data = request.get_json()
    keyword = data.get('keyword')
    product_url = data.get('productUrl')
    if not keyword or not product_url: return jsonify({"status": "error", "message": "키워드와 상품 URL을 모두 입력해야 합니다."}), 400
    target_vendor_item_id = extract_vendor_item_id(product_url)
    if not target_vendor_item_id: return jsonify({"status": "error", "message": "유효하지 않은 상품 URL입니다."}), 400
    result = search_coupang_rank(keyword, target_vendor_item_id)
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)