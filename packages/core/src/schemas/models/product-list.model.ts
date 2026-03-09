import * as z from "zod";
import type { InferType } from "../../zod-utils.js";
import { ProductListIdentifierSchema, ProductListItemIdentifierSchema, ProductListItemSearchIdentifierSchema, ProductListSearchIdentifierSchema, ProductListTypeSchema, ProductVariantIdentifierSchema } from "./identifiers.model.js";
import { BaseModelSchema, createPaginatedResponseSchema, ImageSchema } from './base.model.js';

export const ProductListSchema = BaseModelSchema.extend({
  identifier: ProductListIdentifierSchema.meta({ description: 'The unique identifier for the product list.' }),
  type: ProductListTypeSchema.meta({ description: 'The type of product list, e.g., "wish" or "favorite".' }),
  name: z.string().meta({ description: 'The name of the product list.' }),
  description: z.string().optional().meta({ description: 'A description of the product list. A longer text providing more details about the list.' }),
  image: ImageSchema.optional().meta({ description: 'Icon or image associated with list '}),
  published: z.boolean().default(true).meta({ description: 'Whether the wish list is published and visible to others. Semantics may vary. ' }),
  publishDate: z.string().optional().meta({ description: 'The date at which a list is published for others to see. Sematics may vary' }),
})



export const ProductListItemSchema = BaseModelSchema.extend({
  identifier: ProductListItemIdentifierSchema.meta({ description: 'The unique identifier for the product list item.' }),
  variant: ProductVariantIdentifierSchema.meta({ description: 'The identifier for the product variant that is included in the list.' }),
  quantity: z.number().positive({
    error: 'Quantity must be a positive number.',
  }).meta({ description: 'The quantity of the product variant that is included in the list.' }),
  notes: z.string().optional().meta({ description: 'Additional notes or comments about the product variant in the list.' }),
  order: z.number().default(1).meta({ description: 'The order of the item in the list. This can be used to sort the items in the list.' }),
});

export const ProductListPaginatedResultsSchema = createPaginatedResponseSchema(ProductListSchema).extend({
  identifier: ProductListSearchIdentifierSchema.meta({ description: 'The search parameters applied to retrive this subset of the items in the list.'  }),
})

export const ProductListItemPaginatedResultsSchema = createPaginatedResponseSchema(ProductListItemSchema).extend({
  identifier: ProductListItemSearchIdentifierSchema.meta({ description: 'The search parameters applied to retrive this subset of the items in the list.'  }),
})

export type ProductList = InferType<typeof ProductListSchema>;
export type ProductListItem = InferType<typeof ProductListItemSchema>;
export type ProductListPaginatedResult = InferType<typeof ProductListPaginatedResultsSchema>;
export type ProductListItemPaginatedResult = InferType<typeof ProductListItemPaginatedResultsSchema>;
