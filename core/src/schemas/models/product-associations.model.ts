import { z } from "zod";
import { ProductIdentifierSchema, ProductRecommendationIdentifierSchema, ProductVariantIdentifierSchema } from "./identifiers.model.js";
import { ProductSearchResultItemSchema } from "./product-search.model.js";
import type { InferType } from "../../zod-utils.js";
import { BaseModelSchema } from "./base.model.js";

export const BaseProductAssociationsSchema = BaseModelSchema.extend({
    associationIdentifier: ProductAssociationsIdentifierSchema.describe('The identifier for the product recommendation, which includes a key and an algorithm and any other vendor specific/instance specific data '),
});

export const ProductAssociationsIdOnlySchema = BaseProductAssociationsSchema.extend({
    associationReturnType: z.literal('idOnly').describe('The type of recommendation return'),
    product: ProductIdentifierSchema.describe('The identifier for the recommended product.'),
});
export const ProductAssociationsProductSearchResultItemSchema = BaseProductAssociationsSchema.extend({
    associationReturnType: z.literal('productSearchResultItem').describe('The type of recommendation return'),
    product: ProductSearchResultItemSchema.describe('The recommended product, including its identifier, name, slug, and variants. This can be used to display the recommended product directly on the frontend without needing to make an additional request to fetch the product details.'),
});

export const ProductAssociationsSchema = z.discriminatedUnion('associationReturnType', [
  ProductAssociationsIdOnlySchema,
  ProductAssociationsProductSearchResultItemSchema
]);

export type ProductAssociationsIdOnly = InferType<typeof ProductAssociationsIdOnlySchema>;
export type ProductAssociationsSearchItem = InferType<typeof ProductAssociationsProductSearchResultItemSchema>;
export type ProductAssociations = InferType<typeof ProductAssociationsSchema>;
