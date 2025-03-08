import {S3Event} from "aws-lambda";
import {GetObjectCommand} from "@aws-sdk/client-s3";
import {Readable, Transform} from "stream";
import {handler as importFileParserFunctions, s3Client} from "../importFileParser";

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
}));


jest.mock("csv-parser", () => {
  return () => {
    return new Transform({
      objectMode: true,
      transform(
          chunk: Buffer,
          encoding: string,
          callback: (error?: Error | null, data?: any) => void
      ) {
        try {
          const data = chunk
              .toString()
              .split(",")
              .reduce((acc, curr, idx) => {
                acc[`field${idx}`] = curr;
                return acc;
              }, {} as Record<string, string>);
          this.push(data);
          callback();
        } catch (error) {
          callback(error as Error);
        }
      },
    });
  };
});

describe("importFileParser Lambda", () => {
  const mockSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    s3Client.send = mockSend;
  });

  it("should process CSV file successfully", async () => {
    const mockCsvContent = "Product 1,Description 1\nProduct 2,Description 2";
    const mockReadable = Readable.from([mockCsvContent]);

    mockSend.mockResolvedValueOnce({
      Body: mockReadable,
    });

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/test.csv",
            },
          },
        },
      ],
    } as any;

    const response = await importFileParserFunctions(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("CSV processing completed successfully");
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "uploaded/test.csv",
    });
  });

  it("should handle errors when processing CSV file", async () => {
    const error = new Error("Failed to get object");
    mockSend.mockRejectedValueOnce(error);

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/test.csv",
            },
          },
        },
      ],
    } as any;

    await expect(importFileParserFunctions(event)).rejects.toThrow(
      "Failed to get object"
    );
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should handle multiple records in the event", async () => {
    // Create a mock readable stream with CSV content
    const mockCsvContent = "Product 1,Description 1";
    const mockReadable = Readable.from([mockCsvContent]);

    // Mock S3 getObject response
    mockSend.mockResolvedValue({
      Body: mockReadable,
    });

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/test1.csv",
            },
          },
        },
        {
          s3: {
            bucket: {
              name: "test-bucket",
            },
            object: {
              key: "uploaded/test2.csv",
            },
          },
        },
      ],
    } as any;

    const response = await importFileParserFunctions(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe("CSV processing completed successfully");
    expect(mockSend).toHaveBeenCalledTimes(2);
  });

});
