#!/bin/bash

# 오류 발생 시 즉시 중단
set -e

# Google Chrome (stable) 다운로드 및 설치
# dpkg는 사용자 디렉토리에 설치할 수 있으므로 권한 문제가 없음
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
dpkg -x google-chrome-stable_current_amd64.deb .

# 최신 안정 버전의 Chromedriver 다운로드
CHROME_DRIVER_URL=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json | jq -r '.channels.Stable.downloads.chromedriver[] | select(.platform=="linux64") | .url')
wget -O chromedriver.zip ${CHROME_DRIVER_URL}
unzip chromedriver.zip

# chromedriver를 현재 작업 디렉토리(backend 폴더)로 이동
mv chromedriver-linux64/chromedriver .
chmod +x ./chromedriver

# 임시 파일 정리
rm google-chrome-stable_current_amd64.deb chromedriver.zip