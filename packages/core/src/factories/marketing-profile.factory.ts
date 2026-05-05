import type * as z from 'zod';
import type { MarketingProfileSchema } from '../schemas/models/marketing-profile.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyMarketingProfileSchema = z.ZodType<z.output<typeof MarketingProfileSchema>>;

export interface MarketingProfileFactory<
  TMarketingProfileSchema extends AnyMarketingProfileSchema = AnyMarketingProfileSchema,
> {
  marketingProfileSchema: TMarketingProfileSchema;
  parseMarketingProfile(context: RequestContext, data: unknown): z.output<TMarketingProfileSchema>;
}

export type MarketingProfileFactoryOutput<TFactory extends MarketingProfileFactory> = ReturnType<
  TFactory['parseMarketingProfile']
>;

export type MarketingProfileFactoryWithOutput<TFactory extends MarketingProfileFactory> = Omit<
  TFactory,
  'parseMarketingProfile'
> & {
  parseMarketingProfile(
    context: RequestContext,
    data: unknown,
  ): MarketingProfileFactoryOutput<TFactory>;
};
