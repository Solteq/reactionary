import { CategorySchema } from '@reactionary/core';
import * as z from 'zod';

/**
 * HCL-specific extension of the core Category schema.
 * Adds `uniqueId` — the internal HCL uniqueID required by the product search
 * API's `categoryId` parameter. Stored here so `createCategoryNavigationFilter`
 * can return it without an extra API call.
 */
export const HclCategorySchema = CategorySchema.extend({
  uniqueId: z.string().optional(),
  parentUniqueId: z.string().optional(),
});

export type HclCategory = z.output<typeof HclCategorySchema>;
