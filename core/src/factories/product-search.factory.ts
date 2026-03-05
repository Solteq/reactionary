import type * as z from 'zod';
import type { ProductSearchResultSchema } from '../schemas/models/product-search.model.js';
import type { ProductSearchQueryByTerm } from '../schemas/queries/product-search.query.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProductSearchResultSchema = z.ZodType<
  z.output<typeof ProductSearchResultSchema>
>;

export interface ProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = AnyProductSearchResultSchema,
> {
  productSearchResultSchema: TProductSearchResultSchema;
  parseSearchResult(
    context: RequestContext,
    data: unknown,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema>;
}

export type ProductSearchFactoryOutput<TFactory extends ProductSearchFactory> =
  ReturnType<TFactory['parseSearchResult']>;

export type ProductSearchFactoryWithOutput<TFactory extends ProductSearchFactory> =
  Omit<TFactory, 'parseSearchResult'> & {
    parseSearchResult(
      context: RequestContext,
      data: unknown,
      query: ProductSearchQueryByTerm,
    ): ProductSearchFactoryOutput<TFactory>;
  };
