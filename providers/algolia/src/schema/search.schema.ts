import { ProductSearchIdentifierSchema, ProductSearchResultSchema } from '@reactionary/core';
import { z } from 'zod';

export const AlgoliaProductSearchIdentifierSchema = ProductSearchIdentifierSchema.extend({
   key: z.string(),
   index: z.string(),
});

export const AlgoliaProductSearchResultSchema = ProductSearchResultSchema.extend({
    identifier: AlgoliaProductSearchIdentifierSchema.default(() => AlgoliaProductSearchIdentifierSchema.parse({}))
});

export type AlgoliaProductSearchResult = z.infer<typeof AlgoliaProductSearchResultSchema>;
export type AlgoliaProductSearchIdentifier = z.infer<typeof AlgoliaProductSearchIdentifierSchema>;
