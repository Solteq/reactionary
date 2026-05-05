import type {
  AnyMarketingProfileSchema,
  MarketingProfileFactory,
  MarketingProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeMarketingProfileFactory<
  TMarketingProfileSchema extends AnyMarketingProfileSchema = typeof MarketingProfileSchema,
> implements MarketingProfileFactory<TMarketingProfileSchema>
{
  public readonly marketingProfileSchema: TMarketingProfileSchema;

  constructor(marketingProfileSchema: TMarketingProfileSchema) {
    this.marketingProfileSchema = marketingProfileSchema;
  }

  public parseMarketingProfile(
    _context: RequestContext,
    data: unknown,
  ): z.output<TMarketingProfileSchema> {
    return this.marketingProfileSchema.parse(data);
  }
}
