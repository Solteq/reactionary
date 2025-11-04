import { ProductSearchIdentifierSchema, ProductSearchResultSchema } from '@reactionary/core';
import { z } from 'zod';

export const AlgoliaSearchIdentifierSchema = ProductSearchIdentifierSchema.extend({
   key: z.string().default(''),
   index: z.string().default('')
});

export const AlgoliaSearchResultSchema = ProductSearchResultSchema.extend({
    identifier: AlgoliaSearchIdentifierSchema.default(() => AlgoliaSearchIdentifierSchema.parse({}))
});

export type AlgoliaSearchResult = z.infer<typeof AlgoliaSearchResultSchema>;
export type AlgoliaSearchIdentifier = z.infer<typeof AlgoliaSearchIdentifierSchema>;
