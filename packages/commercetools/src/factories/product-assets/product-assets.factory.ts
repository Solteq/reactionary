import type { Asset, AssetSource, LocalizedString } from '@commercetools/platform-sdk';
import type {
  AnyProductAssetSchema,
  ProductAssetSchema,
  ProductAssetType,
  ProductAssetsFactory,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import { getLanguageCodeFromLocale } from '../../core/locale-utils.js';

export interface CommercetoolsProductAssetFactoryInput {
  asset: Asset;
  type: ProductAssetType;
  vendorType?: string;
  /** Language of the asset content, read from its language tag. */
  language?: string;
}

const EMBED_HOSTS: ReadonlyArray<{ provider: string; hosts: readonly string[] }> = [
  { provider: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'] },
  { provider: 'vimeo', hosts: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'] },
];

/**
 * Turns a commercetools asset into a core ProductAsset: the asset is the logical asset, each of its sources is a file
 * (rendition). The asset type and language are resolved by the capability from the asset tags and passed in.
 */
export class CommercetoolsProductAssetsFactory<
  TProductAssetSchema extends AnyProductAssetSchema = typeof ProductAssetSchema,
> implements ProductAssetsFactory<TProductAssetSchema>
{
  public readonly productAssetSchema: TProductAssetSchema;

  constructor(productAssetSchema: TProductAssetSchema) {
    this.productAssetSchema = productAssetSchema;
  }

  public parseAsset(
    context: RequestContext,
    data: CommercetoolsProductAssetFactoryInput,
  ): z.output<TProductAssetSchema> {
    const { asset } = data;
    const description = this.resolveLocalized(context, asset.description);

    const candidate = {
      identifier: { key: asset.key ?? asset.id },
      type: data.type,
      vendorType: data.vendorType,
      title: this.resolveLocalized(context, asset.name) ?? '',
      description: description === undefined || description === '' ? undefined : description,
      files: asset.sources.map((source) => this.parseSource(source, data.language)),
    };

    return this.productAssetSchema.parse(candidate);
  }

  protected parseSource(source: AssetSource, language: string | undefined) {
    const embedProvider = this.detectEmbedProvider(source.uri);
    return {
      url: source.uri,
      mimeType: source.contentType ?? '',
      delivery: embedProvider ? ('embed' as const) : ('file' as const),
      embedProvider,
      language,
    };
  }

  /** Recognises the well-known video hosts whose urls are player pages rather than files. */
  protected detectEmbedProvider(uri: string): string | undefined {
    let host: string;
    try {
      host = new URL(uri).hostname.toLowerCase();
    } catch {
      return undefined;
    }
    return EMBED_HOSTS.find((entry) => entry.hosts.includes(host))?.provider;
  }

  /** The value for the request language, else the first value present. */
  protected resolveLocalized(
    context: RequestContext,
    value: LocalizedString | undefined,
  ): string | undefined {
    if (!value) {
      return undefined;
    }
    const language = getLanguageCodeFromLocale(context.languageContext.locale) || 'en';
    return value[language] ?? value[context.languageContext.locale] ?? Object.values(value)[0];
  }
}
