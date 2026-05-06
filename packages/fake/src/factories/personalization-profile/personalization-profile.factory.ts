import type {
  AnyPersonalizationProfileSchema,
  PersonalizationProfileFactory,
  PersonalizationProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakePersonalizationProfileFactory<
  TPersonalizationProfileSchema extends AnyPersonalizationProfileSchema = typeof PersonalizationProfileSchema,
> implements PersonalizationProfileFactory<TPersonalizationProfileSchema>
{
  public readonly personalizationProfileSchema: TPersonalizationProfileSchema;

  constructor(personalizationProfileSchema: TPersonalizationProfileSchema) {
    this.personalizationProfileSchema = personalizationProfileSchema;
  }

  public parsePersonalizationProfile(
    _context: RequestContext,
    data: unknown,
  ): z.output<TPersonalizationProfileSchema> {
    return this.personalizationProfileSchema.parse(data);
  }
}
