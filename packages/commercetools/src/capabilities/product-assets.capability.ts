import * as z from 'zod';
import type { Asset, ProductProjection } from '@commercetools/platform-sdk';
import {
  type ProductAssetType,
  type ProductAssetsFactory,
  type ProductAssetsFactoryOutput,
  type ProductAssetsFactoryWithOutput,
  type ProductAssetsGetQuery,
  ProductAssetSchema,
  ProductAssetsCapability,
  ProductAssetsGetQuerySchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { Cache, RequestContext, Result } from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsProductAssetsFactory } from '../factories/product-assets/product-assets.factory.js';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

/**
 * Tags that map to an asset type without configuration: the asset type names themselves.
 * `productAssets.tagTypeMap` in the configuration adds to or overrides these.
 */
export const DEFAULT_ASSET_TAG_TYPE_MAP: Readonly<Record<string, ProductAssetType>> = {
  manual: 'manual',
  'user-guide': 'user-guide',
  'installation-guide': 'installation-guide',
  datasheet: 'datasheet',
  certificate: 'certificate',
  warranty: 'warranty',
  'safety-data-sheet': 'safety-data-sheet',
  'energy-label': 'energy-label',
  'product-fiche': 'product-fiche',
  video: 'video',
  '3d-model': '3d-model',
  other: 'other',
};

/**
 * Reads product assets from the native commercetools variant assets.
 *
 * Conventions:
 * - Product-level assets live on the master variant. When a variant is requested, that variant's assets are added.
 * - The asset type comes from the asset tags, mapped through `DEFAULT_ASSET_TAG_TYPE_MAP` plus the configured
 *   `productAssets.tagTypeMap`. An asset without a mapped tag is type `other`, with its first plain tag as vendorType.
 * - The language of the asset content is a `lang:<code>` tag (the prefix is configurable). commercetools asset
 *   sources carry no language, so each language of a document is its own asset; the sources of one asset are
 *   renditions in other formats (e.g. glb and usdz).
 */
export class CommercetoolsProductAssetsCapability<
  TFactory extends ProductAssetsFactory = CommercetoolsProductAssetsFactory,
> extends ProductAssetsCapability<ProductAssetsFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: ProductAssetsFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: ProductAssetsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections();
  }

  @Reactionary({
    inputSchema: ProductAssetsGetQuerySchema,
    outputSchema: z.array(ProductAssetSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getAssets(
    query: ProductAssetsGetQuery,
  ): Promise<Result<ProductAssetsFactoryOutput<TFactory>[]>> {
    const client = await this.getClient();

    const projection = await client
      .withKey({ key: query.forProduct.key })
      .get()
      .execute()
      .then((response) => response.body)
      .catch((e: { statusCode?: number }) => {
        if (e.statusCode === 404) {
          return null;
        }
        throw e;
      });

    if (!projection) {
      return success([]);
    }

    return success(this.collectAssets(projection, query.forVariant?.sku, query.types));
  }

  /**
   * Gathers master variant assets and, when a sku is given, that variant's assets. Variant assets come first, so a
   * variant asset wins over a master asset with the same key.
   */
  protected collectAssets(
    projection: ProductProjection,
    variantSku: string | undefined,
    types: readonly ProductAssetType[] | undefined,
  ): ProductAssetsFactoryOutput<TFactory>[] {
    const requestedVariant =
      variantSku === undefined || projection.masterVariant.sku === variantSku
        ? undefined
        : projection.variants.find((variant) => variant.sku === variantSku);

    const assets = [
      ...this.parseAssets(requestedVariant?.assets),
      ...this.parseAssets(projection.masterVariant.assets),
    ];

    return this.filterByTypes(this.dedupeAssets(assets), types);
  }

  /** Invalid assets (e.g. a relative source uri) are logged and skipped, never fatal for the others. */
  protected parseAssets(assets: readonly Asset[] | undefined): ProductAssetsFactoryOutput<TFactory>[] {
    const result: ProductAssetsFactoryOutput<TFactory>[] = [];
    for (const asset of assets ?? []) {
      const { type, vendorType } = this.resolveType(asset.tags ?? []);
      try {
        result.push(
          this.factory.parseAsset(this.context, {
            asset,
            type,
            vendorType,
            language: this.resolveLanguage(asset.tags ?? []),
          }),
        );
      } catch (err) {
        console.warn(`Skipping invalid product asset ${asset.key ?? asset.id} in commercetools`, err);
      }
    }
    return result;
  }

  protected get tagTypeMap(): Readonly<Record<string, ProductAssetType>> {
    return { ...DEFAULT_ASSET_TAG_TYPE_MAP, ...this.config.productAssets?.tagTypeMap };
  }

  protected get languageTagPrefix(): string {
    return this.config.productAssets?.languageTagPrefix ?? 'lang:';
  }

  /**
   * The first tag that maps to a type decides. With none, the type is `other` and the first plain (non-language) tag
   * is kept as vendorType.
   */
  protected resolveType(tags: readonly string[]): { type: ProductAssetType; vendorType: string | undefined } {
    const typeMap = this.tagTypeMap;
    const plainTags = tags.filter((tag) => !tag.startsWith(this.languageTagPrefix));
    const mapped = plainTags.find((tag) => Object.hasOwn(typeMap, tag));
    return this.mapVendorType(mapped ?? plainTags[0], typeMap);
  }

  protected resolveLanguage(tags: readonly string[]): string | undefined {
    const prefix = this.languageTagPrefix;
    const tag = tags.find((t) => t.startsWith(prefix) && t.length > prefix.length);
    return tag?.slice(prefix.length);
  }
}
