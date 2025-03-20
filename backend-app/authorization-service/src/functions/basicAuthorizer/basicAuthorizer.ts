import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

type Effect = "Allow" | "Deny";

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  try {
    if (!event.authorizationToken) {
      throw new Error("Unauthorized");
    }

    const authToken = event.authorizationToken;
    const encodedCreds = authToken.split(" ")[1];
    const plainCreds = Buffer.from(encodedCreds, "base64")
      .toString("utf-8")
      .split(":");
    const username = plainCreds[0];
    const password = plainCreds[1];

    const storedPassword = process.env[username];
    const effect = (
      !storedPassword || storedPassword !== password ? "Deny" : "Allow"
    ) as Effect;

    const generatePolicy = (
      principalId: string,
      resource: string,
      effect: Effect
    ): APIGatewayAuthorizerResult => {
      return {
        principalId,
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: effect,
              Resource: resource,
            },
          ],
        },
      };
    };

    switch (effect) {
      case "Allow":
        return generatePolicy(encodedCreds, event.methodArn, "Allow");
      case "Deny":
        return generatePolicy(encodedCreds, event.methodArn, "Deny");
      default:
        throw new Error("Unauthorized");
    }
  } catch (error) {
    throw new Error("Unauthorized");
  }
};
