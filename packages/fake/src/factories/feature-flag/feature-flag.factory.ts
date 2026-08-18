import type {
  AnyFeatureFlagSchema,
  FeatureFlagFactory,
  FeatureFlagSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeFeatureFlagFactory<
  TFeatureFlagSchema extends AnyFeatureFlagSchema = typeof FeatureFlagSchema,
> implements FeatureFlagFactory<TFeatureFlagSchema>
{
  public readonly featureFlagSchema: TFeatureFlagSchema;

  constructor(featureFlagSchema: TFeatureFlagSchema) {
    this.featureFlagSchema = featureFlagSchema;
  }

  public parseFeatureFlag(
    _context: RequestContext,
    data: unknown,
  ): z.output<TFeatureFlagSchema> {
    return this.featureFlagSchema.parse(data);
  }
}
