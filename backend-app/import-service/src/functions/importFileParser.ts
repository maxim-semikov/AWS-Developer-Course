import { S3Event } from "aws-lambda";
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import csvParser from "csv-parser";
import { Readable } from "stream";

export const s3Client = new S3Client({});
export const sqsClient = new SQSClient({});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

interface CsvRecord {
  title: string;
  description: string;
  price: string;
  count: string;
}

async function moveFile(bucket: string, sourceKey: string): Promise<void> {
  const targetKey = sourceKey.replace("uploaded/", "parsed/");

  // Copy the file to parsed folder
  await s3Client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: targetKey,
    })
  );

  // Delete the file from uploaded folder
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: sourceKey,
    })
  );

  console.log(`Moved file from ${sourceKey} to ${targetKey}`);
}

async function sendRecordToSQS(record: CsvRecord): Promise<void> {
  if (!SQS_QUEUE_URL) {
    throw new Error("SQS_QUEUE_URL environment variable is not set");
  }

  const productData = {
    title: record.title,
    description: record.description,
    price: Number(record.price),
    count: Number(record.count),
  };

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(productData),
    })
  );
}

export const handler = async (event: S3Event) => {
  console.log(
    "importFileParser lambda called with event:",
    JSON.stringify(event)
  );

  try {
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

      console.log(`Processing file ${key} from bucket ${bucket}`);

      const { Body } = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      if (Body instanceof Readable) {
        await new Promise((resolve, reject) => {
          Body.pipe(csvParser())
            .on("data", async (data: CsvRecord) => {
              try {
                await sendRecordToSQS(data);
                console.log(`Successfully sent record to SQS: ${data.title}`);
              } catch (error) {
                console.error("Error sending record to SQS:", error);
              }
            })
            .on("error", (error: Error) => {
              console.error("Error parsing CSV:", error);
              reject(error);
            })
            .on("end", async () => {
              console.log(`Finished processing file ${key}`);
              try {
                await moveFile(bucket, key);
                resolve(null);
              } catch (error) {
                console.error("Error moving file:", error);
                reject(error);
              }
            });
        });
      }
    }

    return {
      statusCode: 200,
      body: "CSV processing completed successfully",
    };
  } catch (error) {
    console.error("Error processing CSV file:", error);
    throw error;
  }
};
