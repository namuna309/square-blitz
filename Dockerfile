# Node.js 이미지 사용
FROM node:22.12.0-alpine

# 작업 디렉토리 설정
WORKDIR /usr/src/app

# 백엔드 의존성 복사 및 설치
COPY /backend/package*.json ./backend/
RUN cd backend && npm install

# 백엔드 코드 복사
COPY /backend ./backend

# React 정적 파일 복사
COPY /frontend/public ./frontend/public

# 환경 변수 파일 복사 (필요 시)
COPY /backend/.env ./backend/

# 비루트 사용자로 실행
# Express 서버 실행
WORKDIR /usr/src/app/backend
CMD ["npm", "start"]
