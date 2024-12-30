import boto3
import requests
import json
import os
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

load_dotenv()

# 환경 변수에서 설정 로드
OPENSEARCH_ENDPOINT = os.getenv('OPENSEARCH_ENDPOINT')
OPENSEARCH_USERNAME = os.getenv('OPENSEARCH_USERNAME')
OPENSEARCH_PASSWORD = os.getenv('OPENSEARCH_PASSWORD')
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL')

# SQS 메시지 전송 함수
def send_message_to_sqs(sqs, message):
    try:
        response = sqs.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        return {"status": "success", "message_id": response["MessageId"]}
    except Exception as e:
        return {"status": "error", "error_message": str(e)}

# OpenSearch 데이터 가져오기 및 메시지 전송
def fetch_and_send_logs(index_name, start_date, end_date, chunk_size=5000):
    url = f"{OPENSEARCH_ENDPOINT}/{index_name}/_search?scroll=2m"
    query = {
        "query": {
            "range": {
                "timestamp": {
                    "gte": start_date,
                    "lt": end_date,
                    "format": "strict_date_time"  # ISO-8601 포맷 (Z 포함)
                }
            }
        },
        "size": chunk_size
    }

    headers = {
        'Content-Type': 'application/json',
    }
    auth = (OPENSEARCH_USERNAME, OPENSEARCH_PASSWORD)
    sqs = boto3.client('sqs')


    total_chunks = 0
    failed_messages = []
    successful_messages = []

    try:
        # 첫 번째 요청
        response = requests.post(url, headers=headers, auth=auth, json=query)
        response.raise_for_status()
        data = response.json()

        hits = data['hits']['hits']
        scroll_id = data['_scroll_id']
        chunk_index = 0

        # 병렬 메시지 전송
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            while hits:
                # SQS 메시지 생성 및 병렬 전송
                message = {
                    "scroll_id": scroll_id,
                    "data": hits,
                    "index_name": index_name,
                    "chunk_index": chunk_index
                }
                futures.append(executor.submit(send_message_to_sqs, sqs, message))
                chunk_index += 1
                total_chunks += 1

                # Scroll API로 다음 청크 가져오기
                scroll_response = requests.post(
                    f"{OPENSEARCH_ENDPOINT}/_search/scroll",
                    headers=headers,
                    auth=auth,
                    json={"scroll": "2m", "scroll_id": scroll_id}
                )
                scroll_response.raise_for_status()
                scroll_data = scroll_response.json()

                hits = scroll_data['hits']['hits']
                scroll_id = scroll_data['_scroll_id']
                    
            # 메시지 전송 결과 확인
            for future in as_completed(futures):
                result = future.result()
                if result["status"] == "success":
                    print(result["message_id"])
                    successful_messages.append(result["message_id"])
                else:
                    print(result["error_message"])
                    failed_messages.append(result["error_message"])

        print(f"Total chunks processed: {total_chunks}")
        print(f"Successful messages: {len(successful_messages)}")
        print(f"Failed messages: {len(failed_messages)}")
        
        return {
            "status": "success" if not failed_messages else "partial_success",
            "total_chunks": total_chunks,
            "successful_messages": len(successful_messages),
            "failed_messages": failed_messages
        }
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching logs from OpenSearch: {e}")
        return {"status": "error", "error_message": str(e)}

# Lambda 핸들러
def lambda_handler(event, context):
    index_name = event.get('index_name')
    if index_name not in ["game-start-logs", "game-data-logs"]:
        return {
            "statusCode": 400,
            "body": json.dumps({"status": "error", "message": "Invalid index_name"})
        }

    # 하루 전 날짜 계산
    today = datetime.now()
    start_date = (today - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"  # 2024-12-29T00:00:00.000Z
    end_date = today.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"  # 2024-12-30T00:00:00.000Z

    # OpenSearch에서 로그 가져오기 및 SQS로 전송
    result = fetch_and_send_logs(index_name, start_date, end_date)

    return {
        "statusCode": 200 if result["status"] == "success" else 500,
        "body": json.dumps(result)
    }

if __name__ == "__main__":
    lambda_handler({
  "index_name": "game-data-logs"
}, '')