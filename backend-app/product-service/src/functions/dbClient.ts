import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.REGION });
export const docClient = DynamoDBDocumentClient.from(ddbClient);
