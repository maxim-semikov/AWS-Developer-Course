import axios, { AxiosError, Method } from "axios";
import { IncomingMessage, ServerResponse } from "http";
import { getServiceUrl } from "./config";
import NodeCache from "node-cache";

const CACHE_TTL = 120; // 2 minutes
const PRODUCTS_CACHE_KEY = "products_list";
const cache = new NodeCache();

const readRequestBody = (req: IncomingMessage): Promise<string> => {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      console.log("Request body read complete:", body);
      resolve(body);
    });
    req.on("error", (error) => {
      console.error("Error reading request body:", error);
      reject(error);
    });

    setTimeout(() => {
      reject(new Error("Request body read timeout"));
    }, 5000);
  });
};

export const proxyRequest = async (
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> => {
  const urlParts = req.url?.split("/") || [];
  const serviceName = urlParts[1];
  const serviceUrl = getServiceUrl(serviceName);

  if (!serviceUrl) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: "Cannot process request" }));
    return;
  }

  try {
    if (
      serviceName === "product" &&
      req.method === "GET" &&
      urlParts[2] === "products"
    ) {
      const cachedProducts = cache.get(PRODUCTS_CACHE_KEY);
      if (cachedProducts) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(cachedProducts));
        return;
      }

      const response = await axios.get(`${serviceUrl}/products`);
      cache.set(PRODUCTS_CACHE_KEY, response.data, CACHE_TTL);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response.data));
      return;
    }

    const body = await readRequestBody(req);

    const axiosConfig = {
      method: req.method as Method,
      url: `${serviceUrl}${req.url?.replace(`/${serviceName}`, "")}`,
      ...(body && { data: JSON.parse(body) }),
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await axios(axiosConfig);

    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response.data));
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      res.writeHead(axiosError.response.status);
      res.end(JSON.stringify(axiosError.response.data));
    } else {
      res.writeHead(500);
      res.end(
        JSON.stringify({
          error: (error as Error)?.message ?? "Something went wrong!",
        })
      );
    }
  }
};
