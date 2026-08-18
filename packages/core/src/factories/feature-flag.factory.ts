import type * as z from 'zod';
import type { FeatureFlagSchema } from '../schemas/models/feature-flags.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyFeatureFlagSchema = z.ZodType<z.output<typeof FeatureFlagSchema>>;

export interface FeatureFlagFactory<
  TFeatureFlagSchema extends AnyFeatureFlagSchema = AnyFeatureFlagSchema,
> {
  featureFlagSchema: TFeatureFlagSchema;
  parseFeatureFlag(context: RequestContext, data: unknown): z.output<TFeatureFlagSchema>;
}

export type FeatureFlagFactoryOutput<TFactory extends FeatureFlagFactory> = ReturnType<
  TFactory['parseFeatureFlag']
>;

export type FeatureFlagFactoryWithOutput<TFactory extends FeatureFlagFactory> = Omit<
  TFactory,
  'parseFeatureFlag'
> & {
  parseFeatureFlag(
    context: RequestContext,
    data: unknown,
  ): FeatureFlagFactoryOutput<TFactory>;
};
