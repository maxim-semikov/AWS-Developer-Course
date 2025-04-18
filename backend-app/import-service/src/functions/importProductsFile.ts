import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { KEY_PREFIX } from "../consts";

const s3Client = new S3Client({});

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const fileName = event.queryStringParameters?.name;

    if (!fileName) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": true,
        },
        body: JSON.stringify({
          message: "Missing required parameter: name",
        }),
      };
    }

    const key = `${KEY_PREFIX}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: key,
      ContentType: "text/csv",
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        url: signedUrl,
      }),
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Credentials": true,
      },
      body: JSON.stringify({
        message: "Internal Server Error",
      }),
    };
  }
};
