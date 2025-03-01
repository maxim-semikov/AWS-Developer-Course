import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import * as path from "path";

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing DynamoDB tables
    const productsTable = dynamodb.Table.fromTableName(
      this,
      "ImportedProductsTable",
      "products"
    );

    const stocksTable = dynamodb.Table.fromTableName(
      this,
      "ImportedStocksTable",
      "stocks"
    );

    // Create Lambda functions with environment variables
    const getProductsListFunction = new lambda.Function(
      this,
      "getProductsList",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "getProductsList.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../dist/src/functions")
        ),
        functionName: "getProductsList",
        environment: {
          PRODUCTS_TABLE: productsTable.tableName,
          STOCKS_TABLE: stocksTable.tableName,
          REGION: this.region,
        },
      }
    );

    // Grant permissions to Lambda
    productsTable.grantReadData(getProductsListFunction);
    stocksTable.grantReadData(getProductsListFunction);

    const getProductByIdFunction = new lambda.Function(this, "getProductById", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "getProductById.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/src/functions")
      ),
      functionName: "getProductById",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        REGION: this.region,
      },
    });

    // Grant permissions to Lambda
    productsTable.grantReadData(getProductByIdFunction);
    stocksTable.grantReadData(getProductByIdFunction);

    const createProductFunction = new lambda.Function(this, "createProduct", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "createProduct.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/src/functions")
      ),
      functionName: "createProduct",
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        REGION: this.region,
      },
    });

    // Grant full write permissions for createProduct function
    productsTable.grantWriteData(createProductFunction);
    stocksTable.grantWriteData(createProductFunction);

    // Create API Gateway
    const api = new apigateway.RestApi(this, "productsApi", {
      restApiName: "Products Service",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create API Gateway resources and methods
    const products = api.root.addResource("products");
    products.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductsListFunction)
    );
    products.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createProductFunction)
    );

    const product = products.addResource("{productId}");
    product.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getProductByIdFunction)
    );
  }
}
