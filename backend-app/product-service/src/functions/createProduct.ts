import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dbClient";
import { randomUUID } from "crypto";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("POST /products request:", {
    body: event.body,
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    const body = JSON.parse(event?.body as string);
    if (
      !body ||
      !body.title ||
      !body.description ||
      !body.price ||
      !body.count ||
      typeof body.title !== "string" ||
      typeof body.description !== "string" ||
      typeof body.price !== "number" ||
      typeof body.count !== "number" ||
      body.price < 0 ||
      body.count < 0
    ) {
      return {
        statusCode: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          message:
            "Invalid input. Required fields: {description: string, title: string, price: number >= 0, count: number >= 0}",
        }),
      };
    }

    const PRODUCT_TABLE = process.env.PRODUCTS_TABLE;
    const STOCK_TABLE = process.env.STOCKS_TABLE;
    const productId = randomUUID();

    const paramsProduct = {
      TableName: PRODUCT_TABLE,
      Item: {
        id: `${productId}`,
        title: body.title,
        description: body.description,
        price: body.price,
      },
    };
    const paramsStock = {
      TableName: STOCK_TABLE,
      Item: {
        product_id: `${productId}`,
        count: body.count,
      },
    };

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: paramsProduct.TableName,
              Item: paramsProduct.Item,
              ConditionExpression: "attribute_not_exists(id)",
            },
          },
          {
            Put: {
              TableName: paramsStock.TableName,
              Item: paramsStock.Item,
              ConditionExpression: "attribute_not_exists(product_id)",
            },
          },
        ],
      })
    );

    return {
      statusCode: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: `${productId}`,
        title: body.title,
        description: body.description,
        price: body.price,
        count: body.count,
      }),
    };
  } catch (error) {
    console.error("Error fetching products:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
