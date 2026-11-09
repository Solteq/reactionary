import * as z from 'zod';
import type { InferType } from '../../zod-utils.js';
import { BaseModelSchema, ImageSchema } from './base.model.js';
import { ProductAssetIdentifierSchema } from './identifiers.model.js';

export const ProductAssetTypeSchema = z
  .enum([
    'manual',
    'user-guide',
    'installation-guide',
    'datasheet',
    'certificate',
    'warranty',
    'safety-data-sheet',
    'energy-label',
    'product-fiche',
    'video',
    '3d-model',
    'other',
  ])
  .meta({ description: 'The kind of asset. Sources map their own vocabulary onto this closed set; the raw source value is kept in vendorType.' });

export const ProductAssetFileDeliverySchema = z
  .enum(['file', 'embed'])
  .meta({ description: 'file: the url points at the file itself. embed: the url is a player/viewer page to be embedded, e.g. a YouTube or Vimeo video.' });

export const ProductAssetFileSchema = z.looseObject({
  url: z.url({ protocol: /^https?$/ }).meta({ description: 'Absolute http(s) URL of the file or embed page. Never relative and never another scheme: the asset may live on any host (backend, CDN, DAM).' }),
  mimeType: z.string().default('').meta({ description: 'MIME type of the file, e.g. application/pdf, video/mp4, model/gltf-binary. Empty when unknown.' }),
  delivery: ProductAssetFileDeliverySchema.default('file'),
  embedProvider: z.string().optional().meta({ description: 'For embeds, the hosting provider, e.g. youtube or vimeo.' }),
  language: z.string().optional().meta({ description: 'Language of the file content as a BCP 47 tag, if known. This is the language of the document, not the site locale. Best effort, not guaranteed.' }),
  sizeBytes: z.int().min(0).optional().meta({ description: 'File size in bytes, if known.' }),
});

export const ProductAssetSchema = BaseModelSchema.extend({
  identifier: ProductAssetIdentifierSchema,
  type: ProductAssetTypeSchema,
  vendorType: z.string().optional().meta({ description: 'The raw type/usage/tag value in the source system that type was mapped from.' }),
  title: z.string().default('').meta({ description: 'Display title of the asset.' }),
  description: z.string().optional(),
  thumbnail: ImageSchema.optional().meta({ description: 'Preview image for the asset, if the source has one.' }),
  validFrom: z.string().optional().meta({ description: 'ISO 8601 date from which the asset is valid, e.g. for certificates and warranties.' }),
  validUntil: z.string().optional().meta({ description: 'ISO 8601 date until which the asset is valid.' }),
  files: z.array(ProductAssetFileSchema).min(1).meta({ description: 'The renditions of this asset: the same asset in different languages or formats, e.g. a manual per language, or a 3D model as glb and usdz.' }),
});

// z.infer, not InferType: InferType brands its result, which turns a union of literals into a type that cannot key a record
export type ProductAssetType = z.infer<typeof ProductAssetTypeSchema>;
export type ProductAssetFile = InferType<typeof ProductAssetFileSchema>;
export type ProductAsset = InferType<typeof ProductAssetSchema>;
