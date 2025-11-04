import { z } from 'zod';
import { CartIdentifierSchema, OrderIdentifierSchema, ProductIdentifierSchema, ProductVariantIdentifierSchema } from '@reactionary/core';

export const MedusaCartIdentifierSchema = CartIdentifierSchema.extend({
  region_id: z.string().optional(),
});

export const MedusaOrderIdentifierSchema = OrderIdentifierSchema.extend({
  display_id: z.number().optional(),
});
export const MedusaSessionSchema = z.looseObject({
  activeCartId: z.string().optional(),
});


export const MedusaSKUIdentifierSchema = ProductVariantIdentifierSchema.extend({
  productIdentifier: ProductIdentifierSchema.default(() => ProductIdentifierSchema.parse({})),
});

export type MedusaCartIdentifier = z.infer<typeof MedusaCartIdentifierSchema>;
export type MedusaOrderIdentifier = z.infer<typeof MedusaOrderIdentifierSchema>;
export type MedusaSKUIdentifier = z.infer<typeof MedusaSKUIdentifierSchema>;

export type MedusaSession = z.infer<typeof MedusaSessionSchema>;
