import type {
  AnyMarketingProfileSchema,
  MarketingProfileFactory,
  MarketingProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaCustomerGroup {
  id: string;
  name: string;
}

export class MedusaMarketingProfileFactory<
  TMarketingProfileSchema extends AnyMarketingProfileSchema = typeof MarketingProfileSchema,
> implements MarketingProfileFactory<TMarketingProfileSchema>
{
  public readonly marketingProfileSchema: TMarketingProfileSchema;

  constructor(marketingProfileSchema: TMarketingProfileSchema) {
    this.marketingProfileSchema = marketingProfileSchema;
  }

  public parseMarketingProfile(
    _context: RequestContext,
    data: { customerId: string; groups: MedusaCustomerGroup[] },
  ): z.output<TMarketingProfileSchema> {
    return this.marketingProfileSchema.parse({
      identifier: { key: data.customerId },
      segments: data.groups.map((g) => g.name),
      blurb: '',
    });
  }
}
