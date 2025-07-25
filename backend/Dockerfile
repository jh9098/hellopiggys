# 1. 베이스 이미지: 공식 Python 3.11 이미지를 사용하여 안정성 확보
FROM python:3.11-slim-bookworm

# 2. 환경 변수 설정: apt가 대화형 프롬프트를 띄우지 않도록 설정
ENV DEBIAN_FRONTEND=noninteractive

# 3. Chrome 설치에 필요한 도구 및 시스템 라이브러리 설치
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gnupg \
    wget \
    unzip \
    jq \
    # Chrome 실행에 필요한 필수 라이브러리들
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# 4. Google Chrome 공식 리포지토리 설정 및 설치 (가장 안정적인 방법)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# 5. Chromedriver 설치
RUN CHROME_DRIVER_URL=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json | jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform=="linux64") | .url') \
    && wget -O /tmp/chromedriver.zip ${CHROME_DRIVER_URL} \
    && unzip /tmp/chromedriver.zip -d /usr/local/bin \
    && mv /usr/local/bin/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver \
    && chmod +x /usr/local/bin/chromedriver \
    && rm /tmp/chromedriver.zip \
    && rm -rf /usr/local/bin/chromedriver-linux64

# 6. Python 라이브러리 설치
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 7. 소스 코드 복사
COPY . .

# 8. Gunicorn 서버 실행
CMD ["gunicorn", "--workers", "1", "--timeout", "120", "--bind", "0.0.0.0:10000", "api_server:app"]