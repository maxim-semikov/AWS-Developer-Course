import { S3Event } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import csvParser from "csv-parser";
import { Readable } from "stream";

export const s3Client = new S3Client({});

interface CsvRecord {
  [key: string]: string;
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
            .on("data", (data: CsvRecord) => {
              console.log("Parsed CSV record:", JSON.stringify(data));
            })
            .on("error", (error: Error) => {
              console.error("Error parsing CSV:", error);
              reject(error);
            })
            .on("end", () => {
              console.log(`Finished processing file ${key}`);
              resolve(null);
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
