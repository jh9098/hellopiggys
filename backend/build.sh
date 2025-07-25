# backend/build.sh

#!/bin/bash

# 시스템 패키지 업데이트 및 필수 라이브러리 설치
apt-get update
apt-get install -y wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils

# Google Chrome (stable) 다운로드 및 설치
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
dpkg -i google-chrome-stable_current_amd64.deb || apt-get -fy install

# 최신 Chromedriver 다운로드 (버전은 Chrome 버전에 맞춰야 할 수 있음)
# Chrome for Testing JSON 엔드포인트를 사용하여 안정적인 최신 버전을 찾습니다.
CHROME_DRIVER_VERSION=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json | jq -r '.channels.Stable.version')
wget https://storage.googleapis.com/chrome-for-testing-public/${CHROME_DRIVER_VERSION}/linux64/chromedriver-linux64.zip
unzip chromedriver-linux64.zip

# Chromedriver를 실행 가능한 경로로 이동
mv chromedriver-linux64/chromedriver /usr/local/bin/chromedriver
chmod +x /usr/local/bin/chromedriver

# 임시 파일 정리
rm google-chrome-stable_current_amd64.deb chromedriver-linux64.zip