#!/bin/bash

# 오류 발생 시 즉시 중단
set -e

echo ">>> Starting build process..."

# 1. 시스템 패키지 매니저 업데이트 및 필수 패키지 설치
# Render의 빌드 환경에서는 sudo가 필요할 수 있습니다.
apt-get update -y
apt-get install -y wget unzip fontconfig locales gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils jq

# 2. Google Chrome (stable) 다운로드 및 설치
echo ">>> Downloading and installing Google Chrome..."
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
dpkg -i google-chrome-stable_current_amd64.deb || apt-get -fy install
# Chrome이 설치되었는지 확인
ls -l /usr/bin/google-chrome

# 3. 최신 안정 버전의 Chromedriver 다운로드
echo ">>> Downloading Chromedriver..."
CHROME_DRIVER_URL=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json | jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform=="linux64") | .url')
wget -O chromedriver.zip ${CHROME_DRIVER_URL}
unzip chromedriver.zip

# 4. Chromedriver를 현재 작업 디렉토리(backend 폴더)로 이동
echo ">>> Moving Chromedriver to current directory..."
mv chromedriver-linux64/chromedriver .
chmod +x ./chromedriver
# Chromedriver가 현재 폴더에 있는지 확인
ls -l ./chromedriver

# 5. 임시 파일 정리
echo ">>> Cleaning up temporary files..."
rm google-chrome-stable_current_amd64.deb chromedriver.zip
rm -rf chromedriver-linux64/

echo ">>> Build process finished successfully."