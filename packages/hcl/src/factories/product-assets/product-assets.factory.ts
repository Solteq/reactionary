import type {
  AnyProductAssetSchema,
  ProductAssetSchema,
  ProductAssetType,
  ProductAssetsFactory,
  RequestContext,
} from '@reactionary/core';
import { detectEmbedProvider } from '@reactionary/core';
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
 * for the request language and does not say which language that is, so the file language is left out. A url of an
 * embeddable video player (e.g. youtube.com/embed/…) is an embed, anything else a file.
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
      files: [this.parseFile(data.url, attachment.mimeType)],
    });
  }

  protected parseFile(url: string, mimeType: string) {
    const embedProvider = this.detectEmbedProvider(url);
    return {
      url,
      mimeType,
      delivery: embedProvider ? ('embed' as const) : ('file' as const),
      embedProvider,
    };
  }

  /** Recognises the urls of well-known video players that are meant to be embedded. */
  protected detectEmbedProvider(url: string): string | undefined {
    return detectEmbedProvider(url);
  }
}
