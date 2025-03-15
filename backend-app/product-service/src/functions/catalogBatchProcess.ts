import { SQSEvent } from "aws-lambda";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { docClient } from "./dbClient";
import { randomUUID } from "crypto";

interface ProductItem {
  title: string;
  description: string;
  price: number;
  count: number;
}

const snsClient = new SNSClient({});

async function sendNotification(products: ProductItem[]) {
  const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

  if (!SNS_TOPIC_ARN) {
    throw new Error("SNS_TOPIC_ARN environment variable is not set");
  }

  const message = {
    message: "Products were imported successfully",
    products: products.map((p) => ({
      title: p.title,
      price: p.price,
      count: p.count,
    })),
  };

  await snsClient.send(
    new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Message: JSON.stringify(message, null, 2),
      Subject: "Products Import Notification",
    })
  );
}

export const handler = async (event: SQSEvent) => {
  console.log(
    "catalogBatchProcess lambda called with event:",
    JSON.stringify(event)
  );

  try {
    const processedProducts: ProductItem[] = [];

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

      processedProducts.push(product);
      console.log(`Successfully processed product: ${product.title}`);
    }

    if (processedProducts.length > 0) {
      await sendNotification(processedProducts);
      console.log("Successfully sent notification to SNS");
    }
  } catch (error) {
    console.error("Error processing catalog items:", error);
    throw error; // Rethrowing error to trigger SQS retry mechanism
  }
};
