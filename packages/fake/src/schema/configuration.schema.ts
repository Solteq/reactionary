import * as z from 'zod';

const BooleanFeatureFlagDefinitionSchema = z.looseObject({
  key: z.string(),
  type: z.literal('boolean'),
  enabled: z.boolean(),
});

const MultivariateFeatureFlagDefinitionSchema = z.looseObject({
  key: z.string(),
  type: z.literal('multivariate'),
  variants: z.array(z.string()),
  enabledVariant: z.string(),
});

const FakeFeatureFlagDefinitionSchema = z.discriminatedUnion('type', [
  BooleanFeatureFlagDefinitionSchema,
  MultivariateFeatureFlagDefinitionSchema,
]);

const FakeConfigurationFeatureFlagsSchema = z.looseObject({
  flags: z.array(FakeFeatureFlagDefinitionSchema).default([]),
});

export const FakeConfigurationSchema = z.looseObject({
  jitter: z
    .looseObject({
      mean: z.number().min(0).max(10000),
      deviation: z.number().min(0).max(5000),
    })
    .default({
      mean: 0,
      deviation: 0,
    }),
  seeds: z.looseObject({
    product: z.number().min(0).max(10000).default(1),
    search: z.number().min(0).max(10000).default(1),
    category: z.number().min(0).max(10000).default(1),
  }),
  featureFlags: FakeConfigurationFeatureFlagsSchema.optional(),
});

export type FakeConfiguration = z.infer<typeof FakeConfigurationSchema>;
export type FakeFeatureFlagDefinition = z.infer<typeof FakeFeatureFlagDefinitionSchema>;
