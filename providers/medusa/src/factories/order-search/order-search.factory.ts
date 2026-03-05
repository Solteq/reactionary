import type {
  AnyOrderSearchResultSchema,
  OrderSearchFactory,
  OrderSearchQueryByTerm,
  OrderSearchResultSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class MedusaOrderSearchFactory<
  TOrderSearchResultSchema extends AnyOrderSearchResultSchema = typeof OrderSearchResultSchema,
> implements OrderSearchFactory<TOrderSearchResultSchema>
{
  public readonly orderSearchResultSchema: TOrderSearchResultSchema;

  constructor(orderSearchResultSchema: TOrderSearchResultSchema) {
    this.orderSearchResultSchema = orderSearchResultSchema;
  }

  public parseOrderSearchResult(
    _context: RequestContext,
    data: unknown,
    _query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema> {
    return this.orderSearchResultSchema.parse(data);
  }
}
