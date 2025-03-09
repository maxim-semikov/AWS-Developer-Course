import { APIGatewayProxyEvent } from "aws-lambda";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { handler as importProductsFileFunction } from "../importProductsFile";

jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
}));

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(),
}));


const createEvent = (
    queryParams: Record<string, string> | null
): APIGatewayProxyEvent => ({
  queryStringParameters: queryParams,
  httpMethod: "GET",
  path: "/import",
  headers: {},
  multiValueHeaders: {},
  isBase64Encoded: false,
  pathParameters: null,
  stageVariables: null,
  requestContext: {} as any,
  resource: "",
  multiValueQueryStringParameters: null,
  body: null,
});


describe("importProductsFile Lambda", () => {
  const mockSignedUrl =
    "https://test-bucket.s3.amazonaws.com/uploaded/test.csv";

  beforeEach(() => {
    jest.clearAllMocks();
    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);
    process.env = {
      BUCKET_NAME: "test-bucket",
    };
  });

  it("should return 400 if name parameter is missing", async () => {
    const event = createEvent(null);
    const response = await importProductsFileFunction(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: "Missing required parameter: name",
    });
  });

  it("should return signed URL when name parameter is provided", async () => {
    const event = createEvent({ name: "test.csv" });
    const response = await importProductsFileFunction(event);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      url: mockSignedUrl,
    });
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: "test-bucket",
      Key: "uploaded/test.csv",
      ContentType: "text/csv",
    });
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
  });
});
