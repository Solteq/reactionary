import type {
  AnyProductAssetSchema,
  ProductAssetSchema,
  ProductAssetType,
  ProductAssetsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { HclAttachment } from '../../schema/hcl.schema.js';

export interface HclProductAssetFactoryInput {
  attachment: HclAttachment;
  /** The attachment path as an absolute url. */
  url: string;
  type: ProductAssetType;
  /** The raw attachment usage the type was mapped from. */
  vendorType: string;
}

/**
 * Turns one HCL Commerce attachment into a core ProductAsset with a single file. HCL returns the attachment assets
 * for the request language and does not say which language that is, so the file language is left out.
 */
export class HclProductAssetsFactory<
  TProductAssetSchema extends AnyProductAssetSchema = typeof ProductAssetSchema,
> implements ProductAssetsFactory<TProductAssetSchema>
{
  public readonly productAssetSchema: TProductAssetSchema;

  constructor(productAssetSchema: TProductAssetSchema) {
    this.productAssetSchema = productAssetSchema;
  }

  public parseAsset(
    _context: RequestContext,
    data: HclProductAssetFactoryInput,
  ): z.output<TProductAssetSchema> {
    const { attachment } = data;
    return this.productAssetSchema.parse({
      identifier: { key: attachment.attachmentAssetID },
      type: data.type,
      vendorType: data.vendorType,
      title: attachment.name,
      files: [{ url: data.url, mimeType: attachment.mimeType }],
    });
  }
}
