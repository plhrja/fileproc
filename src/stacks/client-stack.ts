import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deployment from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { Config } from '../config';

export class ClientStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    // Create S3 bucket for hosting Angular app
    const bucket = new s3.Bucket(this, 'AngularAppBucket', {
      publicReadAccess: false,
      removalPolicy: RemovalPolicy.DESTROY, // Use DESTROY only for dev/testing
      autoDeleteObjects: true,
      versioned: true,
      bucketName: Config.CLIENT_BUCKET
    });

    // Deploy Angular app to the S3 bucket
    new s3Deployment.BucketDeployment(this, 'DeployAngularApp', {
      sources: [s3Deployment.Source.asset(Config.CLIENT_DIST)],
      destinationBucket: bucket
    });

    // Lookup hosted zone for the custom domain
    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: Config.PHZ
    });

    // Lookup certificate for cloudfront distro
    const certificate = certificatemanager.Certificate.fromCertificateArn(this, "Certificate", 
      Config.ACM_CERT_ARN);
    
    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'AngularDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(
          bucket,
          {originAccessLevels: [cloudfront.AccessLevel.READ]}
        ),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [Config.DOMAIN],
      certificate
    });

    // Create Route 53 alias record for the CloudFront distribution
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: Config.DOMAIN,
      target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(distribution)),
    });

    // Outputs
    new CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    });
    new CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });
  }
}
