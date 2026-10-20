import { CartIdentifierSchema, OrderIdentifierSchema, type InferType } from '@reactionary/core';
import * as z from 'zod';

export const MedusaCartIdentifierSchema = CartIdentifierSchema.extend({
  region_id: z.string().optional(),
});

export const MedusaOrderIdentifierSchema = OrderIdentifierSchema.extend({
  display_id: z.number().optional(),
});

export const MedusaRegionSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  currency_code: z.string(),
});

/**
 * Cache entry shape for a backend's configured plugin list, as reported by
 * core's `GET /admin/plugins`.
 */
export const MedusaCachedPluginListSchema = z.looseObject({
  plugins: z.array(z.string()),
});

export const MedusaSessionSchema = z.looseObject({
  activeCartId: MedusaCartIdentifierSchema.optional(),
  allOwnedCarts: z.record(z.string(), z.array(MedusaCartIdentifierSchema)).optional(),
  token: z.string().optional(),
  expires: z.string().optional(),
  allRegions: z.array(MedusaRegionSchema).optional(),
  selectedRegion: MedusaRegionSchema.optional(),
  finalizedOrders: z.record(z.string(), MedusaOrderIdentifierSchema).optional().meta({ description: 'Orders created by finalizing a checkout in this session, keyed by the originating cart id. Lets checkout reads report the resulting order when the Medusa store cart endpoint does not expose the cart-to-order relation.' }),
});


export type MedusaCartIdentifier = InferType<typeof MedusaCartIdentifierSchema>;
export type MedusaOrderIdentifier = z.infer<typeof MedusaOrderIdentifierSchema>;

export type MedusaCachedPluginList = z.infer<typeof MedusaCachedPluginListSchema>;
export type MedusaSession = z.infer<typeof MedusaSessionSchema>;
export type MedusaRegion = z.infer<typeof MedusaRegionSchema>;
