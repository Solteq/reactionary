import type {
  AnyPersonalizationProfileSchema,
  PersonalizationProfileFactory,
  PersonalizationProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface HclPersonalizationProfileData {
  personalizationId: string;
  segments: string[];
}

export class HclPersonalizationProfileFactory<
  TPersonalizationProfileSchema extends
    AnyPersonalizationProfileSchema = typeof PersonalizationProfileSchema,
> implements PersonalizationProfileFactory<TPersonalizationProfileSchema>
{
  public readonly personalizationProfileSchema: TPersonalizationProfileSchema;

  constructor(personalizationProfileSchema: TPersonalizationProfileSchema) {
    this.personalizationProfileSchema = personalizationProfileSchema;
  }

  public parsePersonalizationProfile(
    _context: RequestContext,
    data: HclPersonalizationProfileData,
  ): z.output<TPersonalizationProfileSchema> {
    return this.personalizationProfileSchema.parse({
      identifier: { key: data.personalizationId },
      segments: data.segments,
      blurb: '',
    });
  }
}
