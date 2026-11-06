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

/**
 * Urls that can be put in an iframe. A watch page (youtube.com/watch, vimeo.com/<id>) cannot: those hosts refuse
 * framing, so such a url stays a plain file/link.
 */
const EMBED_URLS: ReadonlyArray<{ provider: string; hosts: readonly string[]; pathPrefix: string }> = [
  { provider: 'youtube', hosts: ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'], pathPrefix: '/embed/' },
  { provider: 'vimeo', hosts: ['player.vimeo.com'], pathPrefix: '/video/' },
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

  /** Recognises the urls of well-known video players that are meant to be embedded. */
  protected detectEmbedProvider(uri: string): string | undefined {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      return undefined;
    }
    const host = parsed.hostname.toLowerCase();
    return EMBED_URLS.find((entry) => entry.hosts.includes(host) && parsed.pathname.startsWith(entry.pathPrefix))?.provider;
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
