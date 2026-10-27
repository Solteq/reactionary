import * as z from 'zod';
import type { InferType } from '../zod-utils.js';
import type { Client } from '../client/client.js';
import type { AnalyticsProvider } from '../capabilities/analytics.provider.js';

export const CapabilitiesSchema = z.looseObject({
  product: z.boolean(),
  productSearch: z.boolean(),
  productAssociations: z.boolean(),
  productRecommendations: z.boolean(),
  productReviews: z.boolean(),
  productList: z.boolean(),
  analytics: z.boolean(),
  identity: z.boolean(),
  cart: z.boolean(),
  checkout: z.boolean(),
  order: z.boolean(),
  orderSearch: z.boolean(),
  inventory: z.boolean(),
  price: z.boolean(),
  category: z.boolean(),
  store: z.boolean(),
  profile: z.boolean(),
  featureFlag: z.boolean(),
  personalizationProfile: z.boolean(),
  company: z.boolean(),
  taxonomy: z.boolean(),
});

export type Capabilities = InferType<typeof CapabilitiesSchema>;
/**
 * What a factory provides for a capability key. For `analytics` that is a vendor provider; `client.analytics`
 * itself is the storefront-facing capability the builder creates.
 */
type ProvidedCapability<K extends keyof Client> = K extends 'analytics' ? AnalyticsProvider : Client[K];

export type ClientFromCapabilities<C extends Partial<Capabilities>> = {
  [K in keyof C & keyof Client as C[K] extends true ? K : never]: ProvidedCapability<K>;
};
