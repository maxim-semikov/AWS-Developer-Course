import { DynamoDB, config } from "aws-sdk";
import { v4 as uuidV4 } from "uuid";

config.update({
  region: "eu-central-1",
});

const dynamodb = new DynamoDB.DocumentClient();

const products = [
  {
    title: "iPhone 13 Pro",
    description: "Latest iPhone model with advanced camera system",
    price: 999,
  },
  {
    title: "MacBook Air M1",
    description: "Thin and light laptop with Apple M1 chip",
    price: 1299,
  },
  {
    title: "iPad Pro",
    description: "12.9-inch iPad Pro with M1 chip",
    price: 799,
  },
  {
    title: "AirPods Pro",
    description: "Wireless earbuds with active noise cancellation",
    price: 249,
  },
];

async function fillTables() {
  try {
    for (const product of products) {
      const productId = uuidV4();

      // Добавление записи в таблицу products
      await dynamodb
        .put({
          TableName: "products",
          Item: {
            id: productId,
            title: product.title,
            description: product.description,
            price: product.price,
          },
        })
        .promise();

      // Добавление записи в таблицу stocks
      await dynamodb
        .put({
          TableName: "stocks",
          Item: {
            product_id: productId,
            count: Math.floor(Math.random() * 50) + 10, // Случайное количество от 10 до 60
          },
        })
        .promise();

      console.log(`Added product: ${product.title}`);
    }
    console.log("Tables filled successfully");
  } catch (error) {
    console.error("Error filling tables:", error);
  }
}

fillTables();
