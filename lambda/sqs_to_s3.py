import boto3
import json
import os
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

# 환경 변수 설정
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'square-blitz-game-logs')

# S3에 데이터 저장
def save_logs_to_s3(index_name, chunk_data, chunk_index):
    # S3 저장 경로 생성
    today = datetime.now().strftime('%Y/%m/%d')
    s3_path = f"{index_name}/{today}/logs-{chunk_index}.json"

    try:
        # S3에 업로드
        s3 = boto3.client('s3')
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_path,
            Body=json.dumps(chunk_data),  # JSON 형식으로 저장
            ContentType='application/json'
        )
        print(f"Chunk {chunk_index} saved to s3://{S3_BUCKET_NAME}/{s3_path}")
    except Exception as e:
        print(f"Error saving chunk {chunk_index} to S3: {e}")

# Lambda 핸들러
def lambda_handler(event, context):
    for record in event['Records']:
        message = json.loads(record['body'])  # SQS 메시지 내용
        index_name = message['index_name']
        chunk_data = message['data']
        chunk_index = message['chunk_index']

        # S3에 저장
        save_logs_to_s3(index_name, chunk_data, chunk_index)
