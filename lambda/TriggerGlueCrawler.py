from dotenv import load_dotenv
load_dotenv()

import boto3
import json
import os

glue = boto3.client('glue')

def lambda_handler(event, context):
    try:
        # Glue Crawler 이름
        crawler_name = os.getenv('CRAWLER_NAME')

        # Glue Crawler 실행
        response = glue.start_crawler(Name=crawler_name)
        print(f"Started Glue Crawler: {crawler_name}")
        return {
            "statusCode": 200,
            "body": json.dumps({"message": f"Started Glue Crawler: {crawler_name}"})
        }
    except Exception as e:
        print(f"Error starting Glue Crawler: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }