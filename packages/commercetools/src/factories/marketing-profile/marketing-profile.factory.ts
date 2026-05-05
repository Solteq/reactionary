import type {
  AnyMarketingProfileSchema,
  MarketingProfile,
  MarketingProfileFactory,
  MarketingProfileIdentifier,
  MarketingProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type { Customer } from '@commercetools/platform-sdk';
import type * as z from 'zod';

export class CommercetoolsMarketingProfileFactory<
  TMarketingProfileSchema extends AnyMarketingProfileSchema = typeof MarketingProfileSchema,
> implements MarketingProfileFactory<TMarketingProfileSchema>
{
  public readonly marketingProfileSchema: TMarketingProfileSchema;

  constructor(marketingProfileSchema: TMarketingProfileSchema) {
    this.marketingProfileSchema = marketingProfileSchema;
  }

  public parseMarketingProfile(
    _context: RequestContext,
    data: Customer,
  ): z.output<TMarketingProfileSchema> {
    const segments = (data.customerGroupAssignments ?? [])
      .map((assignment) => assignment.customerGroup.obj?.key)
      .filter((key): key is string => key != null);

    const result = {
      identifier: { key: data.id } satisfies MarketingProfileIdentifier,
      segments,
      blurb: '',
    } satisfies MarketingProfile

    return this.marketingProfileSchema.parse(result);
  }
}
