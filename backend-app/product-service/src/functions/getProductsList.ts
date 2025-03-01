import { APIGatewayProxyHandler } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dbClient";

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log("GET /products request:", {
    pathParameters: event.pathParameters,
    queryStringParameters: event.queryStringParameters,
  });

  try {
    //get data from DB
    const [productsResponse, stocksResponse] = await Promise.all([
      docClient.send(
        new ScanCommand({
          TableName: process.env.PRODUCTS_TABLE,
        })
      ),

      docClient.send(
        new ScanCommand({
          TableName: process.env.STOCKS_TABLE,
        })
      ),
    ]);

    // Join products with stocks
    const products = productsResponse.Items?.map((product) => {
      const stock = stocksResponse.Items?.find(
        (stock) => stock.product_id === product.id
      );

      return {
        ...product,
        count: stock?.count || 0,
      };
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify(products),
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
