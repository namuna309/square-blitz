const express = require("express");
const path = require("path");
const apiRoutes = require("./routes");
require('dotenv').config({ path: '../.env' });

const promClient = require('prom-client'); // Prometheus 클라이언트 라이브러리 불러오기

const app = express();
const PORT = process.env.PORT || 3001;

// Prometheus 메트릭 설정
const register = new promClient.Registry(); // promClient에서 Registry 호출
promClient.collectDefaultMetrics({ register });

const httpRequestCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route"],
});
register.registerMetric(httpRequestCounter);


// 미들웨어: HTTP 요청 카운터 증가
app.use((req, res, next) => {
  if (req.headers["accept"] && req.headers["accept"].includes("text/html"))  {
    httpRequestCounter.labels(req.method, req.path).inc();
  }
  next();
});

// 메트릭 엔드포인트
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// JSON 요청 본문 파싱
app.use(express.json());

// API 라우트 연결
app.use("/api", apiRoutes);

// React 빌드된 정적 파일 제공
app.use(express.static(path.join(__dirname, "../frontend/public")));

// 기본 라우트 처리 (React 앱 반환)
app.get("/", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  dailyVisitorCounter.labels(today).inc(); // 일일 방문자 수 증가
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
