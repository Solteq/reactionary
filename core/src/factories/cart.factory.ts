import type * as z from 'zod';
import type { CartSchema } from '../schemas/models/cart.model.js';
import type { CartIdentifierSchema } from '../schemas/models/identifiers.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyCartSchema = z.ZodType<z.output<typeof CartSchema>>;
export type AnyCartIdentifierSchema = z.ZodType<
  z.output<typeof CartIdentifierSchema>
>;

export interface CartFactory<
  TCartSchema extends AnyCartSchema = AnyCartSchema,
  TCartIdentifierSchema extends AnyCartIdentifierSchema = AnyCartIdentifierSchema,
> {
  cartSchema: TCartSchema;
  cartIdentifierSchema: TCartIdentifierSchema;
  parseCart(context: RequestContext, data: unknown): z.output<TCartSchema>;
  parseCartIdentifier(
    context: RequestContext,
    data: unknown,
  ): z.output<TCartIdentifierSchema>;
}

export type CartFactoryCartOutput<TFactory extends CartFactory> = ReturnType<
  TFactory['parseCart']
>;
export type CartFactoryIdentifierOutput<TFactory extends CartFactory> = ReturnType<
  TFactory['parseCartIdentifier']
>;

export type CartFactoryWithOutput<TFactory extends CartFactory> = Omit<
  TFactory,
  'parseCart' | 'parseCartIdentifier'
> & {
  parseCart(context: RequestContext, data: unknown): CartFactoryCartOutput<TFactory>;
  parseCartIdentifier(
    context: RequestContext,
    data: unknown,
  ): CartFactoryIdentifierOutput<TFactory>;
};
