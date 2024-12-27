const express = require("express");
const axios = require('axios');
const path = require("path");
const apiRoutes = require("./routes");
const { execSync } = require("child_process"); // 명령 실행을 위한 child_process
require('dotenv').config({ path: '../.env' });

const promClient = require('prom-client'); // Prometheus 클라이언트 라이브러리 불러오기

const app = express();
const PORT = process.env.PORT || 3001;
const PRIVATE_IP = process.env.EC2_PRIVATE_IP;
const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT;
const OPENSEARCH_USERNAME = process.env.OPENSEARCH_USERNAME;
const OPENSEARCH_PASSWORD = process.env.OPENSEARCH_PASSWORD;

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
let DOCKER_GATEWAY = null;

try {
  console.log("Fetching Docker Gateway IP...");
  DOCKER_GATEWAY = execSync("ip route | grep default | awk '{print $3}'").toString().trim();
  console.log(`Docker Gateway IP: ${DOCKER_GATEWAY}`);
} catch (error) {
  console.error("Failed to fetch Docker Gateway IP:", error);
  DOCKER_GATEWAY = "127.0.0.1"; // 기본값으로 로컬호스트 사용
}


const allowedIPs = [PRIVATE_IP, DOCKER_GATEWAY, '127.0.0.1', '::1'];

const restrictToPrivateIP = (req, res, next) => {
  
  let clientIP = req.ip || req.connection.remoteAddress;
  
  // IPv6 스타일 (::ffff:)을 제거하여 순수 IPv4 주소로 변환
  if (clientIP.startsWith("::ffff:")) {
    clientIP = clientIP.split("::ffff:")[1];
  }

  if (allowedIPs.some(ip => clientIP.startsWith(ip))) {
    if (clientIP == DOCKER_GATEWAY) {
      console.log(`Access approved for Prometheus: ${clientIP}`)
    }
    else{
      console.log(`Access approved for IP: ${clientIP}`);
    }
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

app.post('/api/log-game-start', (req, res) => {
  const eventLog = req.body;
  index_name = 'log-game-start'

  // OpenSearch로 데이터 전송
  const osLog = {
    index: 'game-start-logs',
    body: eventLog,
  };

  // OpenSearch에 푸시
  axios.post(`${OPENSEARCH_ENDPOINT}/${osLog.index}/_doc`, osLog.body, {
    auth: {
      username: OPENSEARCH_USERNAME,
      password: OPENSEARCH_PASSWORD,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(() => res.status(200).send('Log saved'))
    .catch((err) => {
      console.error('Failed to save log', err);
      res.status(500).send('Error saving log');
    });
});

app.post('/api/log-game-data', (req, res) => {
  const eventLog = req.body;

  // OpenSearch로 데이터 전송
  const osLog = {
    index: 'game-data-logs',
    body: eventLog,
  };

  // OpenSearch에 푸시
  axios.post(`${OPENSEARCH_ENDPOINT}/${osLog.index}/_doc`, osLog.body, {
    auth: {
      username: OPENSEARCH_USERNAME,
      password: OPENSEARCH_PASSWORD,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(() => res.status(200).send('Log saved'))
    .catch((err) => {
      console.error('Failed to save log', err);
      res.status(500).send('Error saving log');
    });
});



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
  console.log(`allowed IPs: ${allowedIPs}`)
  console.log(`Server is running at http://localhost:${PORT}`);
});
