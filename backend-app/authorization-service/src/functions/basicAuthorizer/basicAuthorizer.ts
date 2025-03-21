import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

type Effect = "Allow" | "Deny";

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent, ctx:any, cb: any
) => {
  try {
    console.log('Received event', JSON.stringify(event));

    if(event['type'] !== 'TOKEN') {
      cb('Unauthorized');
    }

    const authToken = event.authorizationToken;
    const encodedCreds = authToken.split(" ")[1];
    const plainCreds = Buffer.from(encodedCreds, "base64")
      .toString("utf-8")
      .split(":");
    const username = plainCreds[0];
    const password = plainCreds[1];

    console.log('Received username ', username, 'and password ', password);

    const storedPassword = process.env[username];
    const effect = (
      !storedPassword || storedPassword !== password ? "Deny" : "Allow"
    ) as Effect;

    const policy = generatePolicy(encodedCreds, event.methodArn, effect);
    cb(null, policy);


  } catch (error: any) {
    cb('Unauthorized: ', error?.message);
  }
};


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
