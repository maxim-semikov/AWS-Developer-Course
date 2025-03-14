import { SQSEvent, SQSHandler } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "./dbClient";
import { randomUUID } from "crypto";

interface ProductItem {
  title: string;
  description: string;
  price: number;
  count: number;
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log(
    "catalogBatchProcess lambda called with event:",
    JSON.stringify(event)
  );

  try {
    for (const record of event.Records) {
      const product: ProductItem = JSON.parse(record.body);

      if (
        !product.title ||
        !product.description ||
        !product.price ||
        !product.count
      ) {
        console.error("Invalid product data:", product);
        continue;
      }

      const productId = randomUUID();

      // Prepare transaction to create product and stock entries
      await docClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: process.env.PRODUCTS_TABLE!,
                Item: {
                  id: productId,
                  title: product.title,
                  description: product.description,
                  price: product.price,
                },
              },
            },
            {
              Put: {
                TableName: process.env.STOCKS_TABLE!,
                Item: {
                  product_id: productId,
                  count: product.count,
                },
              },
            },
          ],
        })
      );

      console.log(`Successfully processed product: ${product.title}`);
    }
  } catch (error) {
    console.error("Error processing catalog items:", error);
    throw error; // Rethrowing error to trigger SQS retry mechanism
  }
};
