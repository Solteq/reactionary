import type {
  AnyProductSearchResultSchema,
  ProductSearchFactory,
  ProductSearchQueryByTerm,
  ProductSearchResultSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class MeilisearchProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = typeof ProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(productSearchResultSchema: TProductSearchResultSchema) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  public parseSearchResult(
    _context: RequestContext,
    data: unknown,
    _query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    return this.productSearchResultSchema.parse(data);
  }
}
