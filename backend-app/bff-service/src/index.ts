import express from "express";
import { config } from "./config";
import { proxyRequest } from "./proxy";

const app = express();

app.use(express.json());

app.use("/:service/*", proxyRequest);

app.listen(config.port, () => {
  console.log(`BFF Service is running on port ${config.port}`);
});
