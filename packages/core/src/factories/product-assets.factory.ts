import type * as z from 'zod';
import type { ProductAssetSchema } from '../schemas/models/product-assets.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

export type AnyProductAssetSchema = z.ZodType<
  z.output<typeof ProductAssetSchema>
>;

export interface ProductAssetsFactory<
  TProductAssetSchema extends AnyProductAssetSchema = AnyProductAssetSchema,
> {
  productAssetSchema: TProductAssetSchema;
  parseAsset(
    context: RequestContext,
    data: unknown,
  ): z.output<TProductAssetSchema>;
}

export type ProductAssetsFactoryOutput<
  TFactory extends ProductAssetsFactory,
> = ReturnType<TFactory['parseAsset']>;

export type ProductAssetsFactoryWithOutput<
  TFactory extends ProductAssetsFactory,
> = Omit<TFactory, 'parseAsset'> & {
  parseAsset(
    context: RequestContext,
    data: unknown,
  ): ProductAssetsFactoryOutput<TFactory>;
};
