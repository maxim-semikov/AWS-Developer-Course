import http from "http";
import { config } from "./config";
import { proxyRequest } from "./proxy";

const server = http.createServer(async (req, res) => {
  const urlParts = req.url?.split("/") || [];
  const service = urlParts[1];

  if (req.url && service) {
    await proxyRequest(req, res);
  } else {
    res.writeHead(502);
    res.end(JSON.stringify({ error: "Cannot process request" }));
  }
});

server.listen(config.port, () => {
  console.log(`BFF Service is running on port: ${config.port}`);
});
