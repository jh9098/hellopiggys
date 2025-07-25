# 1. 베이스 이미지
FROM python:3.11-slim-bookworm

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 단일 RUN 명령으로 모든 설치 작업을 수행
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends wget unzip jq curl ca-certificates fonts-liberation libnss3 libasound2 libatk-bridge2.0-0 libgtk-3-0 libgbm1 && \
    # [★수정★] jq 옆에 curl을 추가했습니다.
    \
    # Google Chrome 다운로드 및 압축 해제
    echo ">>> Downloading and extracting Google Chrome..." && \
    wget -O chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
    dpkg -x chrome.deb . && \
    rm chrome.deb && \
    \
    # Chromedriver 다운로드 및 압축 해제
    echo ">>> Downloading and extracting Chromedriver..." && \
    CHROME_DRIVER_URL=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json | jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform=="linux64") | .url') && \
    wget -O chromedriver.zip ${CHROME_DRIVER_URL} && \
    unzip chromedriver.zip && \
    mv chromedriver-linux64/chromedriver . && \
    chmod +x ./chromedriver && \
    rm chromedriver.zip && \
    rm -rf chromedriver-linux64 && \
    \
    # apt 캐시 정리
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    \
    # 최종 파일 확인
    echo ">>> Final file check:" && \
    ls -la /app && \
    ls -la /app/opt/google/chrome/

# ... 이하 내용은 모두 동일 ...
# 4. Python 라이브러리 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 5. 소스 코드 복사
COPY . .

# 6. Gunicorn 서버 실행
CMD ["gunicorn", "--worker-class", "gevent", "--workers", "1", "--timeout", "120", "--bind", "0.0.0.0:10000", "api_server:app"]