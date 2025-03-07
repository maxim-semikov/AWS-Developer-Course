import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

const bucketName = process.env.BUCKET_NAME || "ms-bucket-uploaded";

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing S3 bucket
    const importBucket = s3.Bucket.fromBucketName(
      this,
      "UploadedBucket",
      bucketName
    );

    // Create Lambda function for import processing
    const importProductsFile = new lambda.Function(this, "ImportProductsFile", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "importProductsFile.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/src/functions")
      ),
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant permissions to Lambda to generate signed URLs
    importBucket.grantReadWrite(importProductsFile);

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service API",
      description: "API for product import service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
      },
    });

    // Create API endpoint for file import
    const importIntegration = new apigateway.LambdaIntegration(
      importProductsFile
    );
    const importResource = api.root.addResource("import");

    // Add query parameter for file name
    importResource.addMethod("GET", importIntegration, {
      requestParameters: {
        "method.request.querystring.name": true,
      },
    });
  }
}
