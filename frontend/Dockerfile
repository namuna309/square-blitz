FROM node:22.12-alpine
WORKDIR /square-blitz/frontend
COPY package.json package-lock.json ./
RUN npm install
COPY . ./
EXPOSE 3000