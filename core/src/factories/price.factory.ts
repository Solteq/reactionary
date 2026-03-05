import type * as z from 'zod';
import type { PriceSchema } from '../schemas/models/price.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyPriceSchema = z.ZodType<z.output<typeof PriceSchema>>;

export interface PriceFactory<TPriceSchema extends AnyPriceSchema = AnyPriceSchema> {
  priceSchema: TPriceSchema;
  parsePrice(
    context: RequestContext,
    data: unknown,
    options?: { includeDiscounts: boolean },
  ): z.output<TPriceSchema>;
}

export type PriceFactoryOutput<TFactory extends PriceFactory> = ReturnType<
  TFactory['parsePrice']
>;

export type PriceFactoryWithOutput<TFactory extends PriceFactory> = Omit<
  TFactory,
  'parsePrice'
> & {
  parsePrice(
    context: RequestContext,
    data: unknown,
    options?: { includeDiscounts: boolean },
  ): PriceFactoryOutput<TFactory>;
};
