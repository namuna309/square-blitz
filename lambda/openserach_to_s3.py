import boto3
import requests
import json
import os
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# 환경 변수에서 설정 로드
OPENSEARCH_ENDPOINT = os.getenv('OPENSEARCH_ENDPOINT')
OPENSEARCH_USERNAME = os.getenv('OPENSEARCH_USERNAME')
OPENSEARCH_PASSWORD = os.getenv('OPENSEARCH_PASSWORD')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'square-blitz-game-logs')

# OpenSearch에서 데이터 가져오기
def fetch_opensearch_logs(index_name):
    url = f"{OPENSEARCH_ENDPOINT}/{index_name}/_search"
    query = {
        "query": {
            "match_all": {}
        },
        "size": 10000  # 한 번에 가져올 최대 데이터 크기
    }
    try:
        response = requests.post(
            url,
            auth=(OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD),
            headers={'Content-Type': 'application/json'},
            json=query
        )
        response.raise_for_status()
        data = response.json()
        return [hit["_source"] for hit in data["hits"]["hits"]]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching logs from OpenSearch: {e}")
        return []

# S3에 데이터 저장 (파티셔닝 적용)
def save_to_s3(index_name, logs):
    if not logs:
        print(f"No logs to save for index: {index_name}")
        return {"status": "success", "message": "No logs to save"}
    
    # 파티션 경로 생성 (예: 2024/01/01/)
    today = datetime.now().strftime('%Y/%m/%d/%H')
    base_path = f"game-start/" if index_name == "game-start-logs" else f"game-data/"
    s3_path = f"{base_path}{today}_logs.json"

    # S3에 저장
    s3 = boto3.client('s3')
    try:
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_path,
            Body=json.dumps(logs),
            ContentType='application/json'
        )
        print(f"Logs successfully saved to s3://{S3_BUCKET_NAME}/{s3_path}")
        return {"status": "success", "message": f"Logs saved to s3://{S3_BUCKET_NAME}/{s3_path}"}
    except Exception as e:
        print(f"Error saving logs to S3: {e}")
        return {"status": "error", "message": str(e)}

# Lambda 핸들러
def lambda_handler(event):
    # 작업 대상 인덱스 확인
    index_name = event.get('index_name')
    if index_name not in ["game-start-logs", "game-data-logs"]:
        return {
            "statusCode": 400,
            "body": json.dumps({"status": "error", "message": "Invalid index_name"})
        }
    
    # OpenSearch에서 로그 가져오기
    logs = fetch_opensearch_logs(index_name)
    # # S3에 저장
    # result = save_to_s3(index_name, logs)

    # return {
    #     "statusCode": 200 if result["status"] == "success" else 500,
    #     "body": json.dumps(result)
    # }

if __name__ == "__main__":
    lambda_handler({
  "index_name": "game-data-logs"
})