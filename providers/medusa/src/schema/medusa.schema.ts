import { CartIdentifierSchema, OrderIdentifierSchema } from '@reactionary/core';
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

export const MedusaSessionSchema = z.looseObject({
  activeCartId: z.string().optional(),
  token: z.string().optional(),
  expires: z.string().optional(),
  allRegions: z.array(MedusaRegionSchema).optional(),
  selectedRegion: MedusaRegionSchema.optional(),
});


export type MedusaCartIdentifier = z.infer<typeof MedusaCartIdentifierSchema>;
export type MedusaOrderIdentifier = z.infer<typeof MedusaOrderIdentifierSchema>;

export type MedusaSession = z.infer<typeof MedusaSessionSchema>;
export type MedusaRegion = z.infer<typeof MedusaRegionSchema>;
