import boto3
import requests
import json
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
import pyarrow as pa
import pyarrow.parquet as pq  # Parquet 처리를 위한 pyarrow

load_dotenv()

# 환경 변수에서 설정 로드
OPENSEARCH_ENDPOINT = os.getenv('OPENSEARCH_ENDPOINT')
OPENSEARCH_USERNAME = os.getenv('OPENSEARCH_USERNAME')
OPENSEARCH_PASSWORD = os.getenv('OPENSEARCH_PASSWORD')
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'square-blitz-game-logs')

# OpenSearch에서 데이터 가져오기
def fetch_and_save_logs_in_chunks(index_name, start_date, end_date, chunk_size=5000):
    url = f"{OPENSEARCH_ENDPOINT}/{index_name}/_search?scroll=2m"
    query = {
        "query": {
            "range": {
                "timestamp": {
                    "gte": start_date,
                    "lte": end_date,
                    "format": "yyyy-MM-dd'T'HH:mm:ss"
                }
            }
        },
        "size": chunk_size  # 한 번에 가져올 데이터 크기
    }
    
    headers = {
        'Content-Type': 'application/json',
    }
    auth = (OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD)
    all_chunks_saved = 0  # 청크 저장 개수 카운트

    try:
        # 첫 번째 요청
        response = requests.post(url, headers=headers, auth=auth, json=query)
        response.raise_for_status()
        data = response.json()
        
        hits = data['hits']['hits']
        scroll_id = data['_scroll_id']
        chunk_index = 0  # 청크 번호
        
        # 데이터가 있는 동안 반복
        while hits:
            # 청크 데이터를 S3에 저장
            save_logs_to_s3(index_name, hits, chunk_index)
            all_chunks_saved += 1
            chunk_index += 1
            
            # Scroll API로 다음 청크 가져오기
            scroll_url = f"{OPENSEARCH_ENDPOINT}/_search/scroll"
            scroll_query = {
                "scroll": "2m",
                "scroll_id": scroll_id
            }
            scroll_response = requests.post(scroll_url, headers=headers, auth=auth, json=scroll_query)
            scroll_response.raise_for_status()
            scroll_data = scroll_response.json()
            
            hits = scroll_data['hits']['hits']
            scroll_id = scroll_data['_scroll_id']
        
        print(f"All chunks saved: {all_chunks_saved}")
        return {"status": "success", "message": f"{all_chunks_saved} chunks saved to S3"}
    except requests.exceptions.RequestException as e:
        print(f"Error fetching logs from OpenSearch: {e}")
        return {"status": "error", "message": str(e)}

# S3에 데이터 저장 (파티셔닝 적용)
def save_logs_to_s3(index_name, logs, chunk_index):
    # S3 저장 경로 생성
    today = datetime.now().strftime('%Y/%m/%d')
    base_path = f"game-start/" if index_name == "game-start-logs" else f"game-data/"
    s3_path = f"{base_path}{today}/logs-{chunk_index}.json"
    
    try:
        # S3에 업로드
        s3 = boto3.client('s3')
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_path,
            Body=json.dumps([log["_source"] for log in logs]),  # JSON 형식으로 저장
            ContentType='application/json'
        )
        print(f"Chunk {chunk_index} saved to s3://{S3_BUCKET_NAME}/{s3_path}")
    except Exception as e:
        print(f"Error saving chunk {chunk_index} to S3: {e}")

# Lambda 핸들러
def lambda_handler(event):
    # 작업 대상 인덱스 확인
    index_name = event.get('index_name')
    if index_name not in ["game-start-logs", "game-data-logs"]:
        return {
            "statusCode": 400,
            "body": json.dumps({"status": "error", "message": "Invalid index_name"})
        }

    # 하루 전 날짜 계산
    today = datetime.now()
    start_date = (today - timedelta(days=2)).strftime('%Y-%m-%dT00:00:00')
    end_date = today.strftime('%Y-%m-%dT23:59:59')

    # OpenSearch에서 로그 가져오기 및 S3 저장
    result = fetch_and_save_logs_in_chunks(index_name, start_date, end_date)

    return {
        "statusCode": 200 if result["status"] == "success" else 500,
        "body": json.dumps(result)
    }

if __name__ == "__main__":
    lambda_handler({
  "index_name": "game-data-logs"
})