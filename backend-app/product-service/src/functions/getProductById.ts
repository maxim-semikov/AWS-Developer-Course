import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dbClient";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("GET /products/{productId} request:", {
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    const { productId } = event.pathParameters || {};

    if (!productId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "Product ID is required" }),
      };
    }

    // Get product from products table
    const productResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Key: { id: productId },
      })
    );

    if (!productResponse.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Product not found" }),
      };
    }

    // Get stock information
    const stockResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.STOCKS_TABLE,
        Key: { product_id: productId },
      })
    );

    // Combine product with stock information
    const product = {
      ...productResponse.Item,
      count: stockResponse.Item?.count || 0,
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error("Error fetching product:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
