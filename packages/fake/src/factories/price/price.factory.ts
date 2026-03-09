import type {
  AnyPriceSchema,
  PriceFactory,
  PriceSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakePriceFactory<
  TPriceSchema extends AnyPriceSchema = typeof PriceSchema,
> implements PriceFactory<TPriceSchema>
{
  public readonly priceSchema: TPriceSchema;

  constructor(priceSchema: TPriceSchema) {
    this.priceSchema = priceSchema;
  }

  public parsePrice(
    _context: RequestContext,
    data: unknown,
    _options?: { includeDiscounts: boolean },
  ): z.output<TPriceSchema> {
    return this.priceSchema.parse(data);
  }
}
