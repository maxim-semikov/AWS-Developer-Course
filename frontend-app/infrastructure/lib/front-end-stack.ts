import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import { RemovalPolicy } from "aws-cdk-lib";

export class FrontEndStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);


    // Create S3 bucket for hosting
    const hostingBucket = new s3.Bucket(this, "FrontEndHostingBucket", {
      // bucketName: "rs-school-nodejs-aws-developer",
      websiteIndexDocument: "index.html",
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });


    // CloudFront Origin Access Identity
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(
      this,
      "CloudFrontOAI",
      {
        comment: "OAI for web app cloudfront distribution",
      }
    );

    // Grant read permissions to CloudFront
    hostingBucket.grantRead(originAccessIdentity);

    // Create CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "FrontEndDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(hostingBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: "index.html",
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });

    // Deploy site contents to S3 bucket
    new s3deploy.BucketDeployment(this, "DeployWebsite", {
      sources: [s3deploy.Source.asset("../dist")],
      destinationBucket: hostingBucket,
      distribution,
      distributionPaths: ["/*"],
    });

    // Output the CloudFront URL and Distribution ID
    new cdk.CfnOutput(this, "DistributionDomainName", {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "DistributionId", {
      value: distribution.distributionId,
    });
  }
}
