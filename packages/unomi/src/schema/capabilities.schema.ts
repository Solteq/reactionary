import type {
  AnalyticsCapability,
  PersonalizationProfileCapability,
} from '@reactionary/core';
import { CapabilitiesSchema } from '@reactionary/core';
import * as z from 'zod';
import type { UnomiConfiguration } from './configuration.schema.js';
import type { UnomiPersonalizationProfileFactory } from '../factories/personalization-profile/personalization-profile.factory.js';

const OverridableCapabilitySchema = z.looseObject({
  enabled: z.boolean(),
  factory: z.unknown().optional(),
  capability: z.unknown().optional(),
});

export const UnomiCapabilitiesSchema = CapabilitiesSchema.pick({
  analytics: true,
  personalizationProfile: true,
})
  .extend({
    analytics: z.looseObject({
      enabled: z.boolean(),
      capability: z.unknown().optional(),
    }).optional(),
    personalizationProfile: OverridableCapabilitySchema.optional(),
  })
  .partial();

export type UnomiCapabilities = z.infer<typeof UnomiCapabilitiesSchema>;

export interface UnomiCapabilityFactoryArgs {
  config: UnomiConfiguration;
}

export interface UnomiFactoryCapabilityArgs<TFactory>
  extends UnomiCapabilityFactoryArgs {
  factory: TFactory;
}

export interface UnomiPersonalizationProfileCapabilityConfig {
  enabled: boolean;
  factory?: UnomiPersonalizationProfileFactory;
  capability?: (
    args: UnomiFactoryCapabilityArgs<UnomiPersonalizationProfileFactory>,
  ) => PersonalizationProfileCapability;
}

export interface UnomiAnalyticsCapabilityConfig {
  enabled: boolean;
  capability?: (args: UnomiCapabilityFactoryArgs) => AnalyticsCapability;
}
