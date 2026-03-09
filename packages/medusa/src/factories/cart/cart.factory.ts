import type {
  AnyCartIdentifierSchema,
  AnyCartSchema,
  CartFactory,
  CartIdentifierSchema,
  CartSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class MedusaCartFactory<
  TCartSchema extends AnyCartSchema = typeof CartSchema,
  TCartIdentifierSchema extends AnyCartIdentifierSchema = typeof CartIdentifierSchema,
> implements CartFactory<TCartSchema, TCartIdentifierSchema>
{
  public readonly cartSchema: TCartSchema;
  public readonly cartIdentifierSchema: TCartIdentifierSchema;

  constructor(cartSchema: TCartSchema, cartIdentifierSchema: TCartIdentifierSchema) {
    this.cartSchema = cartSchema;
    this.cartIdentifierSchema = cartIdentifierSchema;
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
}
