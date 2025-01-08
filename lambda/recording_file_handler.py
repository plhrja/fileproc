import os
import json
import boto3
from urllib.parse import unquote_plus
from aws_lambda_typing import events

# DynamoDB and S3 Clients
dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

# Environment Variables
table_name = os.environ["DYNAMO_TABLE_NAME"]
table = dynamodb.Table(table_name)

def handler(event: events.S3Event):
    print("Received event:", json.dumps(event, indent=2))
    for record in event["detail"]["records"]:
        try:
            bucket_name = record["s3"]["bucket"]["name"]
            object_key = unquote_plus(record["s3"]["object"]["key"])
            
            # Fetch file metadata
            response = s3.head_object(Bucket=bucket_name, Key=object_key)
            metadata = {
                "file_id": object_key,
                "bucket_name": bucket_name,
                "size": response["ContentLength"],
                "last_modified": response["LastModified"].isoformat(),
                "content_type": response["ContentType"]
            }
            
            # Insert into DynamoDB
            table.put_item(Item=metadata)
            print(f"Successfully processed {object_key}")
        except Exception as e:
            print(f"Error processing file {record}: {e}")
            raise
