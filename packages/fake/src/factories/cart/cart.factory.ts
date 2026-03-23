import type {
  AnyCartIdentifierSchema,
  AnyCartPaginatedSearchResult,
  AnyCartSchema,
  CartFactory,
  CartIdentifierSchema,
  CartPaginatedSearchResultSchema,
  CartQueryList,
  CartSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeCartFactory<
  TCartSchema extends AnyCartSchema = typeof CartSchema,
  TCartIdentifierSchema extends AnyCartIdentifierSchema = typeof CartIdentifierSchema,
  TCartPaginatedSearchResult extends AnyCartPaginatedSearchResult = typeof CartPaginatedSearchResultSchema,
> implements CartFactory<TCartSchema, TCartIdentifierSchema, TCartPaginatedSearchResult>
{
  public readonly cartSchema: TCartSchema;
  public readonly cartIdentifierSchema: TCartIdentifierSchema;
  public readonly cartPaginatedSearchResultSchema: TCartPaginatedSearchResult;

  constructor(
    cartSchema: TCartSchema,
    cartIdentifierSchema: TCartIdentifierSchema,
    cartPaginatedSearchResultSchema: TCartPaginatedSearchResult,
  ) {
    this.cartSchema = cartSchema;
    this.cartIdentifierSchema = cartIdentifierSchema;
    this.cartPaginatedSearchResultSchema = cartPaginatedSearchResultSchema;
  }

  public parseCart(_context: RequestContext, data: unknown): z.output<TCartSchema> {
    return this.cartSchema.parse(data);
  }

  public parseCartIdentifier(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCartIdentifierSchema> {
    return this.cartIdentifierSchema.parse(data);
  }

  public parseCartPaginatedSearchResult(
    _context: RequestContext,
    data: unknown,
    _query: CartQueryList,
  ): z.output<TCartPaginatedSearchResult> {
    return this.cartPaginatedSearchResultSchema.parse(data);
  }
}
