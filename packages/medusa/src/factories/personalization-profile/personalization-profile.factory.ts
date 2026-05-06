import type {
  AnyPersonalizationProfileSchema,
  PersonalizationProfileFactory,
  PersonalizationProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface MedusaCustomerGroup {
  id: string;
  name: string;
}

export class MedusaPersonalizationProfileFactory<
  TPersonalizationProfileSchema extends AnyPersonalizationProfileSchema = typeof PersonalizationProfileSchema,
> implements PersonalizationProfileFactory<TPersonalizationProfileSchema>
{
  public readonly personalizationProfileSchema: TPersonalizationProfileSchema;

  constructor(personalizationProfileSchema: TPersonalizationProfileSchema) {
    this.personalizationProfileSchema = personalizationProfileSchema;
  }

  public parsePersonalizationProfile(
    _context: RequestContext,
    data: { customerId: string; groups: MedusaCustomerGroup[] },
  ): z.output<TPersonalizationProfileSchema> {
    return this.personalizationProfileSchema.parse({
      identifier: { key: data.customerId },
      segments: data.groups.map((g) => g.name),
      blurb: '',
    });
  }
}
