import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { ProductIdentifierSchema, ProductVariantIdentifierSchema } from '../models/identifiers.model.js';
import { ProductAssetTypeSchema } from '../models/product-assets.model.js';
import { BaseQuerySchema } from './base.query.js';

export const ProductAssetsGetQuerySchema = BaseQuerySchema.extend({
  forProduct: ProductIdentifierSchema.meta({ description: 'The product to get assets for. Product-level assets are always returned.' }),
  forVariant: ProductVariantIdentifierSchema.optional().meta({ description: 'When given, assets attached to this variant are returned as well. Assets present on both product and variant are returned once.' }),
  types: z.array(ProductAssetTypeSchema).optional().meta({ description: 'Restrict the result to these asset types. All types when omitted.' }),
});

export type ProductAssetsGetQuery = InferType<typeof ProductAssetsGetQuerySchema>;
