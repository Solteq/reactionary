import type * as z from 'zod';
import type {
  AnyProductAssetSchema,
  ProductAssetSchema,
  ProductAssetsFactory,
  RequestContext,
} from '@reactionary/core';

/**
 * Parses one entry of the `assets` metadata array of a Medusa product or variant. The entry is already in the
 * core shape, so parsing is plain schema validation; override to read a different metadata layout.
 */
export class MedusaProductAssetsFactory<
  TProductAssetSchema extends AnyProductAssetSchema = typeof ProductAssetSchema,
> implements ProductAssetsFactory<TProductAssetSchema>
{
  public readonly productAssetSchema: TProductAssetSchema;

  constructor(productAssetSchema: TProductAssetSchema) {
    this.productAssetSchema = productAssetSchema;
  }

  public parseAsset(
    _context: RequestContext,
    data: unknown,
  ): z.output<TProductAssetSchema> {
    return this.productAssetSchema.parse(data);
  }
}
