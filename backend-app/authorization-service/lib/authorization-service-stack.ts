import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as nodejsLambda from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export class AuthorizationServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPassword = process.env.maximsemikov;
    if (!userPassword) {
      throw new Error("Missing required environment variable: maximsemikov");
    }

    const basicAuthorizer = new nodejsLambda.NodejsFunction(
      this,
      "BasicAuthorizer",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(
          __dirname,
          "../src/functions/basicAuthorizer/basicAuthorizer.ts"
        ),
        handler: "handler",
        environment: {
          maximsemikov: userPassword,
        },
        bundling: {
          externalModules: [],
        },
      }
    );

    // Add permission for API Gateway to invoke the Lambda authorizer
    basicAuthorizer.addPermission("APIGatewayInvoke", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });

    new cdk.CfnOutput(this, "BasicAuthorizerArn", {
      value: basicAuthorizer.functionArn,
      exportName: "BasicAuthorizerArn",
    });

    new cdk.CfnOutput(this, "BasicAuthorizerName", {
      value: basicAuthorizer.functionName,
      exportName: "BasicAuthorizerName",
    });
  }
}
