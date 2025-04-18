import dotenv from "dotenv";

dotenv.config();

interface ServiceConfig {
  product: string;
  cart: string;
  [key: string]: string | undefined;
}

export const config = {
  port: process.env.PORT || 3000,
  services: {
    product: process.env.PRODUCT_SERVICE_URL,
    cart: process.env.CART_SERVICE_URL,
  } as ServiceConfig,
};

export const getServiceUrl = (serviceName: string): string | undefined => {
  return config.services[serviceName];
};
