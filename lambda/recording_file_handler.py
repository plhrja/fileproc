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

def handler(event: events.EventBridgeEvent, context):
    print("Received event:", json.dumps(event))
    try:
        bucket_name = event["detail"]["bucket"]["name"]
        object_key = unquote_plus(event["detail"]["object"]["key"])
        
        # Fetch file content
        s3_object = s3.get_object(Bucket=bucket_name, Key=object_key)
        file_content = s3_object['Body'].read().decode('utf-8')
        data = json.loads(file_content, strict=False)
        
        with table.batch_writer() as batch:
            for item in data:
                batch.put_item(Item=item)

        print(f"Successfully processed {object_key}")
    except Exception as e:
        print(f"Error processing event {event}: {e}")
        raise