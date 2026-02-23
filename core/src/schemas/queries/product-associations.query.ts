import * as z from "zod";
import { BaseQuerySchema } from "./base.query.js";
import { ProductIdentifierSchema, ProductVariantIdentifierSchema } from "../models/identifiers.model.js";
import { CartItemSchema } from "../models/cart.model.js";

export const ProductAssociationsGetAccessoriesQuerySchema = BaseQuerySchema.extend({
  forProduct: ProductIdentifierSchema.describe('The product identifier for which to get accessory recommendations. The provider should return recommendations that are relevant to this product, e.g., products that are frequently bought together, products that are similar in style or category, or products that are popular among users with similar preferences.'),
  numberOfAccessories: z.number().min(1).max(12).meta({ description: 'The number of accessory recommendations requested. The provider may return fewer than this number, but should not return more.' }),
});

export const ProductAssociationsGetSparepartsQuerySchema = BaseQuerySchema.extend({
  forProduct: ProductIdentifierSchema.describe('The product identifier for which to get similar item recommendations. The provider should return recommendations that are relevant to this product, e.g., products that are frequently bought together, products that are similar in style or category, or products that are popular among users with similar preferences.'),
  numberOfSpareparts: z.number().min(1).max(12).meta({ description: 'The number of spare part recommendations requested. The provider may return fewer than this number, but should not return more.' }),
});

export const ProductAssociationsGetReplacementsQuerySchema = BaseQuerySchema.extend({
  forProduct: ProductIdentifierSchema.describe('The product identifier for which to get replacement recommendations. The provider should return recommendations that are relevant to this product, e.g., products that are frequently bought together, products that are similar in style or category, or products that are popular among users with similar preferences.'),
  numberOfReplacements: z.number().min(1).max(12).meta({ description: 'The number of replacement recommendations requested. The provider may return fewer than this number, but should not return more.' }),
});



export type ProductAssociationsGetAccessoriesQuery = z.infer<typeof ProductAssociationsGetAccessoriesQuerySchema>;
export type ProductAssociationsGetSparepartsQuery = z.infer<typeof ProductAssociationsGetSparepartsQuerySchema>;
export type ProductAssociationsGetReplacementsQuery = z.infer<typeof ProductAssociationsGetReplacementsQuerySchema>;
