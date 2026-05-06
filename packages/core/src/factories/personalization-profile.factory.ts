import type * as z from 'zod';
import type { PersonalizationProfileSchema } from '../schemas/models/personalization-profile.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyPersonalizationProfileSchema = z.ZodType<z.output<typeof PersonalizationProfileSchema>>;

export interface PersonalizationProfileFactory<
  TPersonalizationProfileSchema extends AnyPersonalizationProfileSchema = AnyPersonalizationProfileSchema,
> {
  personalizationProfileSchema: TPersonalizationProfileSchema;
  parsePersonalizationProfile(context: RequestContext, data: unknown): z.output<TPersonalizationProfileSchema>;
}

export type PersonalizationProfileFactoryOutput<TFactory extends PersonalizationProfileFactory> = ReturnType<
  TFactory['parsePersonalizationProfile']
>;

export type PersonalizationProfileFactoryWithOutput<TFactory extends PersonalizationProfileFactory> = Omit<
  TFactory,
  'parsePersonalizationProfile'
> & {
  parsePersonalizationProfile(
    context: RequestContext,
    data: unknown,
  ): PersonalizationProfileFactoryOutput<TFactory>;
};
