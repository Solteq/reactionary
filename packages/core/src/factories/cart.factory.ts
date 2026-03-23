import type * as z from 'zod';
import type { CartPaginatedSearchResultSchema, CartSchema } from '../schemas/models/cart.model.js';
import type { CartIdentifierSchema } from '../schemas/models/identifiers.model.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { CartQueryList } from '../schemas/queries/cart.query.js';

export type AnyCartSchema = z.ZodType<z.output<typeof CartSchema>>;
export type AnyCartIdentifierSchema = z.ZodType<
  z.output<typeof CartIdentifierSchema>
>;
export type AnyCartPaginatedSearchResult = z.ZodType<
  z.output<typeof CartPaginatedSearchResultSchema>
>;

export interface CartFactory<
  TCartSchema extends AnyCartSchema = AnyCartSchema,
  TCartIdentifierSchema extends AnyCartIdentifierSchema = AnyCartIdentifierSchema,
  TCartPaginatedSearchResult extends AnyCartPaginatedSearchResult = AnyCartPaginatedSearchResult
> {
  cartSchema: TCartSchema;
  cartIdentifierSchema: TCartIdentifierSchema;
  cartPaginatedSearchResultSchema: TCartPaginatedSearchResult;
  parseCart(context: RequestContext, data: unknown): z.output<TCartSchema>;
  parseCartIdentifier(
    context: RequestContext,
    data: unknown,
  ): z.output<TCartIdentifierSchema>;
  parseCartPaginatedSearchResult(
    context: RequestContext,
    data: unknown,
    query: CartQueryList
  ): z.output<TCartPaginatedSearchResult>;
}

export type CartFactoryCartOutput<TFactory extends CartFactory> = ReturnType<
  TFactory['parseCart']
>;
export type CartFactoryIdentifierOutput<TFactory extends CartFactory> = ReturnType<
  TFactory['parseCartIdentifier']
>;

export type CartFactoryPaginatedSearchResultOutput<TFactory extends CartFactory> = ReturnType<
  TFactory['parseCartPaginatedSearchResult']
>;


export type CartFactoryWithOutput<TFactory extends CartFactory> = Omit<
  TFactory,
  'parseCart' | 'parseCartIdentifier' | 'parseCartPaginatedSearchResult'
> & {
  parseCart(context: RequestContext, data: unknown): CartFactoryCartOutput<TFactory>;
  parseCartIdentifier(
    context: RequestContext,
    data: unknown,
  ): CartFactoryIdentifierOutput<TFactory>;
  parseCartPaginatedSearchResult(
    context: RequestContext,
    data: unknown,
    query: CartQueryList
  ): CartFactoryPaginatedSearchResultOutput<TFactory>;
};
