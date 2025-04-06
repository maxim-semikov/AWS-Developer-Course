import { Product } from "~/models/Product";

export type CartItem = {
  product_id: string;
  count: number;
  product?: Product;
};
