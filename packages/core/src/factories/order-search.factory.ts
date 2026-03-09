import type * as z from 'zod';
import type { OrderSearchResultSchema } from '../schemas/models/order-search.model.js';
import type { OrderSearchQueryByTerm } from '../schemas/queries/order-search.query.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyOrderSearchResultSchema = z.ZodType<
  z.output<typeof OrderSearchResultSchema>
>;

export interface OrderSearchFactory<
  TOrderSearchResultSchema extends AnyOrderSearchResultSchema = AnyOrderSearchResultSchema,
> {
  orderSearchResultSchema: TOrderSearchResultSchema;
  parseOrderSearchResult(
    context: RequestContext,
    data: unknown,
    query: OrderSearchQueryByTerm,
  ): z.output<TOrderSearchResultSchema>;
}

export type OrderSearchFactoryOutput<TFactory extends OrderSearchFactory> =
  ReturnType<TFactory['parseOrderSearchResult']>;

export type OrderSearchFactoryWithOutput<TFactory extends OrderSearchFactory> = Omit<
  TFactory,
  'parseOrderSearchResult'
> & {
  parseOrderSearchResult(
    context: RequestContext,
    data: unknown,
    query: OrderSearchQueryByTerm,
  ): OrderSearchFactoryOutput<TFactory>;
};
