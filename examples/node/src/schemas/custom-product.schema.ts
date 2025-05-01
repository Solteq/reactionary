import { z } from 'zod';
import { ProductSchema } from '@reactionary/core';

export const CustomProductSchema = ProductSchema.extend({
  gtin: z.string().min(8),
});

export type CustomProduct = z.infer<typeof CustomProductSchema>;