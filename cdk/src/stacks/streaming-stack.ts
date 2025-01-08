import {
  aws_s3 as s3,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_events as events,
  aws_events_targets as targets,
  Stack,
  StackProps,
  RemovalPolicy,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { Config } from "../config";
import { PythonFunction } from "@aws-cdk/aws-lambda-python-alpha";

export class FileProcStreamingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Bucket
    const bucket = new s3.Bucket(this, "FileUploadBucket", {
      bucketName: Config.FILE_UPLOAD_BUCKET,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      eventBridgeEnabled: true
    });

    // DynamoDB Table
    const table = new dynamodb.TableV2(this, "recording", {
      tableName: Config.RECORDING_TABLE, 
      billing: dynamodb.Billing.onDemand(),
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING},
      removalPolicy: RemovalPolicy.DESTROY
    });

    // EventBridge Event Bus
    // const eventBus = new events.EventBus(this, "EventBus");

    // Lambda Function
    const lambdaFunction = new PythonFunction(this, "S3ToDynamoFunction", {
      runtime: lambda.Runtime.PYTHON_3_9,
      entry: Config.FILE_HANDLER_DIST,
      index: "recording_file_handler.py",
      handler: "handler",
      environment: {
        DYNAMO_TABLE_NAME: table.tableName,
      },
    });

    // Grant Lambda permissions to access DynamoDB table
    table.grantReadWriteData(lambdaFunction);

    // EventBridge Rule to Trigger Lambda
    new events.Rule(this, "FileCreatedRule", {
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: {
            name: [bucket.bucketName]
          }
        }
      },
      enabled: true,
      targets: [new targets.LambdaFunction(lambdaFunction)],
    });

    // Outputs
    new CfnOutput(this, "BucketName", { 
      value: bucket.bucketName,
      exportName: "FileUploadBucket"
    });
    new CfnOutput(this, "TableName", { 
      value: table.tableName,
      exportName: "RecordingTableName" 
    });
    // new cdk.CfnOutput(this, "EventBusName", { value: eventBus.eventBusName });
  }
}
