# 1. 베이스 이미지
FROM python:3.11-slim-bookworm

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 필수 도구 및 Chrome 런타임 라이브러리 설치
# apt-get은 여전히 필요하지만, Chrome 자체를 설치하지는 않음
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget unzip jq fontconfig libnss3 libasound2 libatk-bridge2.0-0 libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# 4. Google Chrome을 .deb 파일로 다운로드하고, 시스템이 아닌 현재 폴더에 압축 해제
RUN wget -O chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && dpkg -x chrome.deb . \
    && rm chrome.deb

# 5. Chromedriver를 다운로드하고, 현재 폴더에 압축 해제
RUN CHROME_DRIVER_URL=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json | jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform=="linux64") | .url') \
    && wget -O chromedriver.zip ${CHROME_DRIVER_URL} \
    && unzip chromedriver.zip \
    && mv chromedriver-linux64/chromedriver . \
    && chmod +x ./chromedriver \
    && rm chromedriver.zip \
    && rm -rf chromedriver-linux64

# 6. Python 라이브러리 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 7. 소스 코드 복사
COPY . .

# 8. Gunicorn 서버 실행
CMD ["gunicorn", "--workers", "1", "--timeout", "120", "--bind", "0.0.0.0:10000", "api_server:app"]