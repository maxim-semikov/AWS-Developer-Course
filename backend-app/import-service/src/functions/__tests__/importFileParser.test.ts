import { S3Event } from "aws-lambda";
import {
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable, Transform } from "stream";
import {
  handler as importFileParserFunctions,
  s3Client,
} from "../importFileParser";

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(),
  GetObjectCommand: jest.fn(),
  CopyObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
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

  it("should process CSV file and move it to parsed folder", async () => {
    const mockCsvContent = "Product 1,Description 1\nProduct 2,Description 2";
    const mockReadable = Readable.from([mockCsvContent]);

    mockSend
      .mockResolvedValueOnce({ Body: mockReadable }) // GetObjectCommand
      .mockResolvedValueOnce({}) // CopyObjectCommand
      .mockResolvedValueOnce({}); // DeleteObjectCommand

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

    // Verify file operations
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "uploaded/test.csv",
    });
    expect(CopyObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      CopySource: "test-bucket/uploaded/test.csv",
      Key: "parsed/test.csv",
    });
    expect(DeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "uploaded/test.csv",
    });
    expect(mockSend).toHaveBeenCalledTimes(3);
  });

  it("should handle errors when moving file", async () => {
    const mockCsvContent = "Product 1,Description 1";
    const mockReadable = Readable.from([mockCsvContent]);
    const error = new Error("Failed to copy file");

    mockSend
      .mockResolvedValueOnce({ Body: mockReadable }) // GetObjectCommand
      .mockRejectedValueOnce(error); // CopyObjectCommand fails

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
      "Failed to copy file"
    );
    expect(mockSend).toHaveBeenCalledTimes(2); // GetObject and failed CopyObject
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
    const mockCsvContent = "Product 1,Description 1";
    const mockReadable = Readable.from([mockCsvContent]);

    // Mock responses for each file (GetObject, Copy, Delete)
    mockSend
      .mockResolvedValueOnce({ Body: mockReadable }) // GetObject for file1
      .mockResolvedValueOnce({}) // Copy for file1
      .mockResolvedValueOnce({}) // Delete for file1
      .mockResolvedValueOnce({ Body: mockReadable }) // GetObject for file2
      .mockResolvedValueOnce({}) // Copy for file2
      .mockResolvedValueOnce({}); // Delete for file2

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
    expect(mockSend).toHaveBeenCalledTimes(6); // 3 operations per file
  });
});
