import { SQSEvent } from "aws-lambda";
import { handler } from "./catalogBatchProcess";
import { docClient } from "./dbClient";

// Mock AWS SDK clients
jest.mock("./dbClient");

// Mock SNS client
jest.mock("@aws-sdk/client-sns", () => {
  const mockSend = jest.fn();
  return {
    SNSClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PublishCommand: jest.fn().mockImplementation((params) => params),
    mockSend,
  };
});

const { mockSend } = jest.requireMock("@aws-sdk/client-sns");

describe("catalogBatchProcess lambda", () => {
  const mockDynamoSend = jest.fn().mockResolvedValue({});

  const mockSQSEvent: SQSEvent = {
    Records: [
      {
        messageId: "1",
        receiptHandle: "handle1",
        body: JSON.stringify({
          title: "Test Product",
          description: "Test Description",
          price: 100,
          count: 10,
        }),
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: "1",
          SenderId: "sender1",
          ApproximateFirstReceiveTimestamp: "1",
        },
        messageAttributes: {},
        md5OfBody: "md5",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs",
        awsRegion: "eu-west-1",
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (docClient.send as jest.Mock).mockImplementation(mockDynamoSend);

    process.env.PRODUCTS_TABLE = "products-table";
    process.env.STOCKS_TABLE = "stocks-table";
    process.env.SNS_TOPIC_ARN =
      "arn:aws:sns:eu-west-1:123456789012:import-products-topic";
  });

  it("should successfully process valid product", async () => {
    mockSend.mockResolvedValueOnce({});

    await handler(mockSQSEvent);

    expect(mockDynamoSend).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          TransactItems: expect.arrayContaining([
            expect.objectContaining({
              Put: expect.objectContaining({
                TableName: "products-table",
                Item: expect.objectContaining({
                  title: "Test Product",
                  description: "Test Description",
                  price: 100,
                }),
              }),
            }),
            expect.objectContaining({
              Put: expect.objectContaining({
                TableName: "stocks-table",
                Item: expect.objectContaining({
                  count: 10,
                }),
              }),
            }),
          ]),
        },
      })
    );

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Message: expect.any(String),
        Subject: "Products Import Notification",
      })
    );
  });

  it("should skip invalid product data", async () => {
    const invalidSQSEvent: SQSEvent = {
      Records: [
        {
          ...mockSQSEvent.Records[0],
          body: JSON.stringify({
            title: "Invalid Product",
            // missing required fields
          }),
        },
      ],
    };

    await handler(invalidSQSEvent);

    expect(mockDynamoSend).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should handle DynamoDB errors", async () => {
    const mockError = new Error("DynamoDB error");
    mockDynamoSend.mockRejectedValueOnce(mockError);

    await expect(handler(mockSQSEvent)).rejects.toThrow("DynamoDB error");
  });

  it("should handle SNS errors", async () => {
    mockSend.mockRejectedValueOnce(new Error("SNS error"));

    await expect(handler(mockSQSEvent)).rejects.toThrow("SNS error");
  });
});
