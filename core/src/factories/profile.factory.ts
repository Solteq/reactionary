import type * as z from 'zod';
import type { ProfileSchema } from '../schemas/models/profile.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProfileSchema = z.ZodType<z.output<typeof ProfileSchema>>;

export interface ProfileFactory<
  TProfileSchema extends AnyProfileSchema = AnyProfileSchema,
> {
  profileSchema: TProfileSchema;
  parseProfile(context: RequestContext, data: unknown): z.output<TProfileSchema>;
}

export type ProfileFactoryOutput<TFactory extends ProfileFactory> = ReturnType<
  TFactory['parseProfile']
>;

export type ProfileFactoryWithOutput<TFactory extends ProfileFactory> = Omit<
  TFactory,
  'parseProfile'
> & {
  parseProfile(context: RequestContext, data: unknown): ProfileFactoryOutput<TFactory>;
};
