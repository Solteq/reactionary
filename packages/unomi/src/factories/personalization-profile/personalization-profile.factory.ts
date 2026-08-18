import type {
  AnyPersonalizationProfileSchema,
  PersonalizationProfileFactory,
  PersonalizationProfileSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export interface UnomiProfileResponse {
  itemId?: string;
  profileId?: string;
  properties?: Record<string, unknown>;
  segments?: Array<string | { id?: string; name?: string }>;
}

export class UnomiPersonalizationProfileFactory<
  TPersonalizationProfileSchema extends AnyPersonalizationProfileSchema = typeof PersonalizationProfileSchema,
> implements PersonalizationProfileFactory<TPersonalizationProfileSchema> {
  public readonly personalizationProfileSchema: TPersonalizationProfileSchema;

  constructor(personalizationProfileSchema: TPersonalizationProfileSchema) {
    this.personalizationProfileSchema = personalizationProfileSchema;
  }

  public parsePersonalizationProfile(
    _context: RequestContext,
    data: UnomiProfileResponse & { profileId: string },
  ): z.output<TPersonalizationProfileSchema> {
    const segments = (data.segments ?? [])
      .map((segment) => typeof segment === 'string' ? segment : segment.name ?? segment.id)
      .filter((segment): segment is string => Boolean(segment));
    const blurb = typeof data.properties?.['description'] === 'string'
      ? data.properties['description']
      : '';

    return this.personalizationProfileSchema.parse({
      identifier: { key: data.profileId },
      segments,
      blurb,
    });
  }
}
