from dotenv import load_dotenv
load_dotenv()

import boto3
from boto3.dynamodb.conditions import Key
import json
import os
import pandas as pd
from datetime import datetime
from io import BytesIO

# AWS 클라이언트 설정
s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
sqs = boto3.client('sqs')

# 환경 변수 설정
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', 'square-blitz-game-logs')
DYNAMODB_TABLE_NAME = os.getenv('DYNAMODB_TABLE_NAME', 'MessageProcessingStatus')

# DynamoDB 테이블 참조
table = dynamodb.Table(DYNAMODB_TABLE_NAME)

# Parquet으로 S3에 데이터 저장
def save_logs_to_s3_parquet(index_name, chunk_data, chunk_index):
    # S3 저장 경로 생성
    today = datetime.now().strftime('year=%Y/month=%m/day=%d')
    s3_path = f"{index_name}/{index_name.upper()}/{today}/{chunk_index}.parquet"

    try:
        # Pandas DataFrame으로 변환
        df = pd.DataFrame(chunk_data)

        # Parquet 변환
        parquet_buffer = BytesIO()
        df.to_parquet(parquet_buffer, engine='pyarrow', index=False)

         # S3에 업로드
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_path,
            Body=parquet_buffer.getvalue(),
            ContentType='application/octet-stream'  # Parquet의 MIME 타입
        )
        print(f"Parquet chunk {chunk_index} saved to s3://{S3_BUCKET_NAME}/{s3_path}")
        return {"status": "success", "message": f"Parquet chunk {chunk_index} saved successfully."}
    except Exception as e:
        error_message = f"Error saving Parquet chunk {chunk_index} to S3: {e}"
        print(error_message)
        return {"status": "error", "message": error_message}

def update_message_status(message_id, status):
    try:
        # 메시지가 존재하지 않으면 생성
        response = table.get_item(Key={'message_id': message_id})
        if 'Item' not in response:
            table.put_item(Item={
                'message_id': message_id,
                'status': status,
                'updated_at': datetime.now().isoformat()
            })
            print(f"Message {message_id} created with status: {status}")
        else:
            # 메시지 상태 업데이트
            table.update_item(
                Key={'message_id': message_id},
                UpdateExpression="SET #s = :status, updated_at = :timestamp",
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={
                    ':status': status,
                    ':timestamp': datetime.now().isoformat()
                }
            )
            print(f"Message {message_id} updated to status: {status}")
    except Exception as e:
        error_message = f"Error updating message {message_id} to status {status}: {e}"
        print(error_message)

# 모든 메시지 처리 완료 여부 확인
def check_all_messages_processed():
    try:
        response = table.query(
            IndexName="status-index",  # 상태별로 인덱스를 생성했다고 가정
            KeyConditionExpression=Key("status").eq("in_progress")
        )
        remaining_messages = len(response.get('Items', []))
        print(f"Remaining in_progress messages: {remaining_messages}")
        return remaining_messages == 0
    except Exception as e:
        error_message = f"Error checking all messages processed: {e}"
        print(error_message)
        return False

# _SUCCESS 파일 저장
def save_success_marker():
    today = datetime.now().strftime('%Y/%m/%d')
    success_path = f"logs-ingestion-complete/{today}/_SUCCESS"

    try:
        s3.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=success_path,
            Body="",  # 빈 파일
            ContentType="text/plain"
        )
        print(f"_SUCCESS file saved to s3://{S3_BUCKET_NAME}/{success_path}")
    except Exception as e:
        error_message = f"Error saving _SUCCESS file: {e}"
        print(error_message)

def lambda_handler(event, context):
    results = []  # 처리 결과를 저장할 리스트

    for record in event['Records']:
        message = json.loads(record['body'])  # SQS 메시지 내용
        message_id = record['messageId']
        index_name = message['index_name']
        chunk_data = message['data']
        chunk_index = message['chunk_index']

        # 메시지 상태를 `in_progress`로 설정
        update_message_status(message_id, 'in_progress')

        # 메시지 처리 및 Parquet 저장
        result = save_logs_to_s3_parquet(index_name, chunk_data, chunk_index)
        results.append({"message_id": message_id, "result": result})

        # 메시지 상태를 `completed`로 설정
        if result["status"] == "success":
            update_message_status(message_id, 'completed')
        else:
            print(f"Message {message_id} failed to process. Skipping status update to 'completed'.")
    
    # 모든 메시지가 처리되었는지 확인
    if check_all_messages_processed():
        print("All messages processed. Creating _SUCCESS file...")
        save_success_marker()

    # 처리 결과를 반환
    print("Processing results:", results)
    return {
        "statusCode": 200,
        "body": json.dumps({
            "message": "Processing complete",
            "results": results
        })
    }