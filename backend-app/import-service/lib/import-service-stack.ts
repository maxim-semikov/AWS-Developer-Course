import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { KEY_PREFIX } from "../src/consts";

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

    // Get reference to the existing SQS queue
    const catalogItemsQueueArn = cdk.Fn.importValue("CatalogItemsQueueArn");
    const catalogItemsQueueUrl = cdk.Fn.importValue("CatalogItemsQueueUrl");

    // Get reference to the basicAuthorizer lambda
    const basicAuthorizer = lambda.Function.fromFunctionArn(
      this,
      "BasicAuthorizer",
      cdk.Fn.importValue("BasicAuthorizerArn")
    );

    // Create Lambda function for import processing
    const importProductsFile = new nodejsLambda.NodejsFunction(
      this,
      "ImportProductsFile",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "../src/functions/importProductsFile.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: importBucket.bucketName,
        },
        bundling: {
          externalModules: [],
        },
        timeout: cdk.Duration.seconds(30),
      }
    );

    // Create Lambda function for parsing uploaded files
    const importFileParser = new nodejsLambda.NodejsFunction(
      this,
      "ImportFileParser",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "../src/functions/importFileParser.ts"),
        handler: "handler",
        environment: {
          BUCKET_NAME: importBucket.bucketName,
          SQS_QUEUE_URL: catalogItemsQueueUrl,
        },
        bundling: {
          externalModules: [],
        },
        timeout: cdk.Duration.seconds(60),
      }
    );

    // Grant SQS permissions to importFileParser
    importFileParser.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sqs:SendMessage"],
        resources: [catalogItemsQueueArn],
      })
    );

    // Grant permissions to Lambda functions
    importBucket.grantReadWrite(importProductsFile);
    importBucket.grantReadWrite(importFileParser);

    // Add S3 notification for CSV files in uploaded folder
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: `${KEY_PREFIX}/` }
    );

    // Create API Gateway
    const api = new apigateway.RestApi(this, "ImportApi", {
      restApiName: "Import Service API",
      description: "API for product import service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
        ],
      },
    });

    // Create Lambda authorizer
    const authorizer = new apigateway.TokenAuthorizer(
      this,
      "ImportAuthorizer",
      {
        handler: basicAuthorizer,
      }
    );

    // Create API endpoint for file import
    const importIntegration = new apigateway.LambdaIntegration(
      importProductsFile,
    );
    const importResource = api.root.addResource("import");

    // Add query parameter for file name
    importResource.addMethod("GET", importIntegration, {
      requestParameters: {
        "method.request.querystring.name": true,
      },
        requestValidatorOptions: {
            validateRequestParameters: true,
        },
        authorizer: authorizer,
        authorizationType: apigateway.AuthorizationType.CUSTOM,
    });

      api.addGatewayResponse("Unauthorized", {
          type: apigateway.ResponseType.UNAUTHORIZED,
          statusCode: "401",
          responseHeaders: {
              "Access-Control-Allow-Origin": "'*'",
          },
          templates: {
              "application/json": JSON.stringify({
                  message: "Unauthorized",
                  statusCode: 401,
              }),
          },
      });

      api.addGatewayResponse("Forbidden", {
          type: apigateway.ResponseType.ACCESS_DENIED,
          statusCode: "403",
          responseHeaders: {
              "Access-Control-Allow-Origin": "'*'",
          },
          templates: {
              "application/json": JSON.stringify({
                  message: "Forbidden",
                  statusCode: 403,
              }),
          },
      });
  }
}
