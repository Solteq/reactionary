import * as z from "zod";
import { ProductIdentifierSchema, ProductAssociationsIdentifierSchema, ProductVariantIdentifierSchema } from "./identifiers.model.js";
import { ProductSearchResultItemSchema } from "./product-search.model.js";
import type { InferType } from "../../zod-utils.js";
import { BaseModelSchema } from "./base.model.js";

export const BaseProductAssociationSchema = BaseModelSchema.extend({
    associationIdentifier: ProductAssociationsIdentifierSchema.meta({ description: 'The identifier for the product recommendation, which includes a key and an algorithm and any other vendor specific/instance specific data '}),
});

export const ProductAssociationIdOnlySchema = BaseProductAssociationSchema.extend({
    associationReturnType: z.literal('idOnly').meta({ description: 'The type of recommendation return'}),
    product: ProductIdentifierSchema.meta({ description: 'The identifier for the recommended product.'}),
});
export const ProductAssociationProductSearchResultItemSchema = BaseProductAssociationSchema.extend({
    associationReturnType: z.literal('productSearchResultItem').meta({ description: 'The type of recommendation return'}),
    product: ProductSearchResultItemSchema.meta({ description: 'The recommended product, including its identifier, name, slug, and variants. This can be used to display the recommended product directly on the frontend without needing to make an additional request to fetch the product details.'}),
});

export const ProductAssociationSchema = z.discriminatedUnion('associationReturnType', [
  ProductAssociationIdOnlySchema,
  ProductAssociationProductSearchResultItemSchema
]);

export type ProductAssociationIdOnly = InferType<typeof ProductAssociationIdOnlySchema>;
export type ProductAssociationSearchItem = InferType<typeof ProductAssociationProductSearchResultItemSchema>;
export type ProductAssociation = InferType<typeof ProductAssociationSchema>;
