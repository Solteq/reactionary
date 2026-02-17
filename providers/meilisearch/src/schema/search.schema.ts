import { ProductSearchIdentifierSchema, ProductSearchResultSchema } from '@reactionary/core';
import { z } from 'zod';

export const MeilisearchProductSearchIdentifierSchema = ProductSearchIdentifierSchema.extend({
   key: z.string(),
   index: z.string(),
});

export const MeilisearchProductSearchResultSchema = ProductSearchResultSchema.extend({
    identifier: MeilisearchProductSearchIdentifierSchema.default(() => MeilisearchProductSearchIdentifierSchema.parse({}))
});

export type MeilisearchProductSearchResult = z.infer<typeof MeilisearchProductSearchResultSchema>;
export type MeilisearchProductSearchIdentifier = z.infer<typeof MeilisearchProductSearchIdentifierSchema>;
export interface MeilisearchNativeVariant {
  sku: string;
  image: string;
}

export interface MeilisearchNativeRecord {
  objectID: string;
  slug?: string;
  name?: string;
  variants: Array<MeilisearchNativeVariant>;
}
