import axios, { AxiosError, Method } from "axios";
import { Request, Response } from "express";
import { getServiceUrl } from "./config";

export const proxyRequest = async (
  req: Request,
  res: Response
): Promise<void> => {
  const serviceName = req.params.service;
  const serviceUrl = getServiceUrl(serviceName);
  console.log("serviceUrl: ", serviceUrl);

  if (!serviceUrl) {
    res.status(502).json({ error: "Cannot process request" });
    return;
  }

  try {
    const axiosConfig = {
      method: req.method as Method,
      url: `${serviceUrl}${req.originalUrl.replace(`/${serviceName}`, "")}`,
      ...(Object.keys(req.body || {}).length > 0 && { data: req.body }),
      headers: {
        ...req.headers,
        host: new URL(serviceUrl).host,
      },
    };

    console.log("axiosConfig", axiosConfig);

    const response = await axios(axiosConfig);

    res.status(response.status).json(response.data);
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      res.status(axiosError.response.status).json(axiosError.response.data);
    } else {
      res
        .status(500)
        .json({ error: (error as Error)?.message ?? "Something went wrong!" });
    }
  }
};
