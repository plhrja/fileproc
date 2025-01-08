import { Construct } from 'constructs';
import * as firehose from 'aws-cdk-lib/aws-kinesisfirehose';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as redshift from 'aws-cdk-lib/aws-redshiftserverless';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Config } from "../config";
import { CfnOutput, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";

export class StreamingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // S3 Bucket for Firehose intermediate storage
    const bucket = new s3.Bucket(this, 'FirehoseBucket', {
      bucketName: Config.REDSHIFT_BUCKET,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false
    });

    const backupBucket = new s3.Bucket(this, 'FirehoseBackupBucket', {
      bucketName: Config.REDSHIFT_BACKUP_BUCKET,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false
    });

    // Create a VPC for Redshift
    const vpc = new ec2.Vpc(this, 'RedshiftVpc', {
      maxAzs: 3,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'PublicSubnet',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'PrivateSubnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],

    });

    // Redshift Serverless Workgroup and Namespace
    const namespace = new redshift.CfnNamespace(this, 'RedshiftNamespace', {
      namespaceName: Config.REDSHIFT_NS,
      adminUsername: Config.REDSHIFT_ADMIN_USERNAME,
      adminUserPassword: Config.REDSHIFT_ADMIN_PW,
      dbName: Config.REDSHIFT_DB
    });

    const redshiftSecurityGroup = new ec2.SecurityGroup(this, 'RedshiftSecurityGroup', {
      vpc: vpc,
      allowAllOutbound: true
    });
    redshiftSecurityGroup.addIngressRule(
      ec2.Peer.ipv4("52.19.239.192/27"), // See https://docs.aws.amazon.com/firehose/latest/dev/controlling-access.html#using-iam-rs-vpc
      ec2.Port.tcp(5439),
      'Allow Firehose access'
    );

    const workgroup = new redshift.CfnWorkgroup(this, 'RedshiftWorkgroup', {
      workgroupName: Config.REDSHIFT_WG,
      namespaceName: namespace.namespaceName,
      publiclyAccessible: true,
      baseCapacity: Config.REDSHIFT_CAPACITY,
      subnetIds: vpc.publicSubnets.map(s => s.subnetId),
      securityGroupIds: [redshiftSecurityGroup.securityGroupId]
    });

    // IAM Role for Firehose
    const firehoseRole = new iam.Role(this, 'FirehoseRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    });

    bucket.grantReadWrite(firehoseRole);
    backupBucket.grantReadWrite(firehoseRole);

    firehoseRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'redshift-data:ExecuteStatement',
          'redshift-data:BatchExecuteStatement',
          'redshift-data:DescribeStatement',
          'redshift-data:CancelStatement'
        ],
        resources: ['*'], // Replace with specific resource ARN for tighter security
      })
    );

    // Kinesis Data Firehose Delivery Stream and logging
    const logGroup = new logs.LogGroup(this, 'FirehoseLogGroup', {
      removalPolicy: RemovalPolicy.DESTROY,
      retention: logs.RetentionDays.ONE_WEEK
    });

    const logStream = new logs.LogStream(this, 'FirehoseLogStream', {
      logGroup
    });

    logGroup.grantWrite(firehoseRole);

    const stream = new firehose.CfnDeliveryStream(this, 'FirehoseToRedshift', {
      deliveryStreamType: 'DirectPut',
      deliveryStreamName: Config.FIREHOSE_STREAM_NAME,
      redshiftDestinationConfiguration: {
        clusterJdbcurl: `jdbc:redshift://${workgroup.workgroupName}.${this.account}.${this.region}.redshift-serverless.amazonaws.com:5439/canvastream`,
        copyCommand: {
          dataTableName: Config.REDSHIFT_TABLE,
          dataTableColumns: '"id", "timestamp", "coordinate_x", "coordinate_y", "is_drawing"',
          copyOptions: "FORMAT AS JSON 'auto'",
        },
        password: Config.REDSHIFT_ADMIN_PW,
        username: Config.REDSHIFT_ADMIN_USERNAME,
        roleArn: firehoseRole.roleArn,
        s3BackupConfiguration: {
          bucketArn: backupBucket.bucketArn,
          roleArn: firehoseRole.roleArn
        },
        s3Configuration: {
          bucketArn: bucket.bucketArn,
          roleArn: firehoseRole.roleArn,
          bufferingHints: {
            intervalInSeconds: 60,
            sizeInMBs: 1,
          },
          // compressionFormat: "GZIP"
        },
        cloudWatchLoggingOptions: {
          enabled: true,
          logGroupName: logGroup.logGroupName,
          logStreamName: logStream.logStreamName
        }
      }
    });

    // Cognito Identity Pool
    const identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      identityPoolName: Config.COGNITO_ID_POOL_NAME,
      allowUnauthenticatedIdentities: true
    });

    const unauthenticatedRole = new iam.Role(this, 'UnauthenticatedRole', {
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      )
    });

    unauthenticatedRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonKinesisFirehoseFullAccess')
    );

    new cognito.CfnIdentityPoolRoleAttachment(this, 'IdentityPoolRoles', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthenticatedRole.roleArn,
      },
    });

    // Outputs
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      exportName: 'FirehoseBucket'
    });
    new CfnOutput(this, 'RedshiftNamespaceName', {
      value: namespace.namespaceName,
      exportName: 'RedshiftNamespace'
    });
    new CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.attrId,
      exportName: 'CognitoIdentityPoolId'
    });
  }
}
