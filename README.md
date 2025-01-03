# 웹게임(Square-Blitz) 상태 모니터링 시스템 및 로그 데이터 ETL 파이프라인
<br/>

## 프로젝트 개요

이 프로젝트는 **React 웹 게임**을 기반으로 데이터 수집 및 분석을 위한 **모니터링 시스템**과 **로그 데이터 ETL(Extract, Transform, Load) 파이프라인**을 설계하고 구현한 풀스택 프로젝트입니다. 사용자의 게임 플레이 데이터를 수집하여, 실시간으로 모니터링하고 저장된 데이터를 변환 및 분석 가능한 형태로 처리하는 과정을 모두 포함하고 있습니다.

---
<br/><br/>

## 프로젝트 개발 목적

1. **데이터 엔지니어링 학습**  
   데이터 엔지니어링의 핵심 기술을 실무에 가깝게 익히기 위해, 실제 데이터를 생성하고 이를 기반으로 데이터를 처리, 분석하는 모든 단계를 직접 구현했습니다.

2. **풀스택 개발 경험**  
   프론트엔드(React), 백엔드(Express.js), 데이터 파이프라인(AWS), 모니터링 시스템(Prometheus & Grafana)을 모두 아우르는 **엔드-투-엔드 개발 경험**을 쌓기 위한 프로젝트입니다.

3. **비용 최적화 및 확장성**  
   AWS 프리티어를 최대한 활용하여 저비용으로 프로젝트를 운영하며, 동시에 **확장 가능한 아키텍처**를 설계했습니다.

---
<br/>
<br/>

## 주요 기술 스택
| Field | Stack |
|:---:|:---|
| 사용 언어 | <img src="https://img.shields.io/badge/html5-E34F26?style=for-the-badge&logo=html5&logoColor=white"> <img src="https://img.shields.io/badge/css-1572B6?style=for-the-badge&logo=css3&logoColor=white"> <img src="https://img.shields.io/badge/javascript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black"> <img src="https://img.shields.io/badge/python-3776AB?style=for-the-badge&logo=python&logoColor=white"> |
| 프론트엔드 | <img src="https://img.shields.io/badge/react-61DAFB?style=for-the-badge&logo=react&logoColor=white"/> |
| 백엔드 | <img src="https://img.shields.io/badge/express-000000?style=for-the-badge&logo=express&logoColor=white"/> | 
| 모니터링 | <img src="https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=Prometheus&logoColor=white"/> <img src="https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=Grafana&logoColor=white"/>|
| 데이터 파이프라인 | <img src="https://img.shields.io/badge/amazon_lambda-FF9900?style=for-the-badge&logo=awslambda&logoColor=white"/> <img src="https://img.shields.io/badge/amazon_OpenSearch-005EB8?style=for-the-badge&logo=opensearch&logoColor=white"/> <img src="https://img.shields.io/badge/amazon_s3-569A31?style=for-the-badge&logo=amazons3&logoColor=white"/> <img src="https://img.shields.io/badge/amazon_sqs-FF4F8B?style=for-the-badge&logo=amazonsqs&logoColor=white"/> <img src="https://img.shields.io/badge/amazon_glue-512BD4?style=for-the-badge&logo=amazonglue&logoColor=white"/> |
| 컨테이너화 | <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"/> |
| infra | <img src="https://img.shields.io/badge/amazone web service-232F3E?style=for-the-badge&logo=amazonwebservices&logoColor=white"/> |
| CI/CD | <img src="https://img.shields.io/badge/Git Action-2088FF?style=for-the-badge&logo=githubactions&logoColor=white"/> |
---
<br/><br/>

## 아키텍처 다이어그램
![square-blitz 다이어그램-페이지-1 drawio](https://github.com/user-attachments/assets/3ee9dcd1-784a-4de9-be1a-29ddd644ab12)
---
<br/><br/>

## 주요 특징

### 1. React 웹 게임
- 간단한 **연속 터치 게임** 구현
- 클릭한 박스의 수와 성공률 등을 기록하여 **유저 행동 데이터**를 수집

### 2. 백엔드 서버
- **Express.js**를 사용하여 간단하고 효율적인 API 서버 구축
- **Prometheus 메트릭**과 **HTTP 요청 카운터**를 통해 실시간 모니터링 지원
- **IP 제한**을 통한 보안 강화

### 3. 데이터 파이프라인
- **AWS OpenSearch**를 사용하여 로그 데이터를 저장하고 실시간 검색 가능
- **Lambda 함수**를 활용하여 데이터를 **JSON → Parquet** 형식으로 변환
- 변환된 데이터를 **S3**에 저장하며, Athena를 통해 분석 가능
- **SQS 기반 병렬 처리**로 확장성과 안정성을 높임

### 4. 모니터링 시스템
- **Prometheus**와 **Grafana**를 사용해 서버와 애플리케이션 상태를 실시간으로 시각화
- 방문자 수, HTTP 요청 수 등 주요 지표를 대시보드로 확인 가능

---
<br/><br/>

## 개선 및 향후 계획

1. **Redshift 데이터 적재**  
   데이터 분석을 위한 Redshift로의 최종 데이터 적재 단계 추가.

2. **자동 알림 시스템**  
   장애나 에러 발생 시, 관리자에게 즉시 알림을 전달하는 기능 추가.

3. **테스트 자동화**  
   전체 워크플로우에 대한 테스트 케이스를 작성하고, 지속적으로 실행되는 CI/CD 환경 강화.

4. **코드 리팩토링**  
   유지보수성을 높이기 위한 코드 최적화 및 문서화.

---
