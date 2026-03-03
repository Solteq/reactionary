import { ProductListIdentifierSchema, ProductListItemSearchIdentifierSchema, ProductListSearchIdentifierSchema } from "../models/identifiers.model.js";
import { BaseQuerySchema } from "./base.query.js";
import type { InferType } from "../../zod-utils.js";

export const ProductListQueryByIdSchema = BaseQuerySchema.extend({
  identifier: ProductListIdentifierSchema.describe('The unique identifier for the product list to retrieve. For example, this could be the identifier for a specific wishlist or shopping cart.'),
});

export const ProductListQuerySchema = BaseQuerySchema.extend({
  search: ProductListSearchIdentifierSchema.describe('The identifier for the product list to query. The provider should return the items in the list that match this identifier. For example, if the identifier is a customer ID, the provider should return the items in the customer\'s wishlist. If the identifier is a session ID, the provider should return the items in the customer\'s current shopping cart. If the identifier is a product ID, the provider should return the items in the product\'s related products list.'),
});

export const ProductListItemQuerySchema = BaseQuerySchema.extend({
  search: ProductListItemSearchIdentifierSchema.describe('The identifier for the product list to query. The provider should return the items in the list that match this identifier. For example, if the identifier is a customer ID, the provider should return the items in the customer\'s wishlist. If the identifier is a session ID, the provider should return the items in the customer\'s current shopping cart. If the identifier is a product ID, the provider should return the items in the product\'s related products list.'),
});

export type ProductListQueryById = InferType<typeof ProductListQueryByIdSchema>;
export type ProductListQuery = InferType<typeof ProductListQuerySchema>;
export type ProductListItemsQuery = InferType<typeof ProductListItemQuerySchema>;
