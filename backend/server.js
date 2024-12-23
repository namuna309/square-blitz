const express = require("express");
const path = require("path");
const apiRoutes = require("./routes");
require('dotenv').config({ path: '../.env' });

const promClient = require('prom-client'); // Prometheus 클라이언트 라이브러리 불러오기

const app = express();
const PORT = process.env.PORT || 3001;
const PRIVATE_IP = process.env.EC2_PRIVATE_IP

// Prometheus 메트릭 설정
const register = new promClient.Registry(); // promClient에서 Registry 호출
promClient.collectDefaultMetrics({ register });

const httpRequestCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route"],
});
register.registerMetric(httpRequestCounter);

// IP 제한 미들웨어
const restrictToPrivateIP = (req, res, next) => {
  
  const clientIP = req.ip || req.connection.remoteAddress;
 
  if (PRIVATE_IP === clientIP || clientIP === '') {
    console.log(`Access approved for IP: ${clientIP}`);
    return next(); // 프라이빗 IP에서 온 요청은 허용
  }

  console.log(`Access denied for IP: ${clientIP}`);
  res.status(403).send('Access to /metrics is restricted to private network.');
};


// 미들웨어: HTTP 요청 카운터 증가
app.use((req, res, next) => {
  if (req.headers["accept"] && req.headers["accept"].includes("text/html"))  {
    httpRequestCounter.labels(req.method, req.path).inc();
  }
  next();
});


app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// JSON 요청 본문 파싱
app.use(express.json());

// API 라우트 연결
app.use("/api", apiRoutes);

// React 빌드된 정적 파일 제공
app.use(express.static(path.join(__dirname, "../frontend/public")));

// 기본 경로 (퍼블릭) (React 앱 반환)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"));
});

// /metrics 경로 (프라이빗)
app.get('/metrics', restrictToPrivateIP, async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
