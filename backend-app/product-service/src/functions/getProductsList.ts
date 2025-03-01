import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

export const handler: APIGatewayProxyHandler = async () => {
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
      )
    ])

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
