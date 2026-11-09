import * as z from 'zod';
import type { StoreProduct } from '@medusajs/types';
import type {
  Cache,
  ProductAssetType,
  ProductAssetsFactory,
  ProductAssetsFactoryOutput,
  ProductAssetsFactoryWithOutput,
  ProductAssetsGetQuery,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  ProductAssetSchema,
  ProductAssetsCapability,
  ProductAssetsGetQuerySchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaProductAssetsFactory } from '../factories/product-assets/product-assets.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

/**
 * Reads product assets from Medusa metadata: `metadata.assets` on the product and on its variants, each an array of
 * entries in the core ProductAsset shape (logical asset with `files[]`).
 *
 * This is the lightweight storage until a dedicated asset module exists; the entry shape is the same one such a
 * module would return, so the provider output does not change when the storage does.
 */
export class MedusaProductAssetsCapability<
  TFactory extends ProductAssetsFactory = MedusaProductAssetsFactory,
> extends ProductAssetsCapability<ProductAssetsFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected medusa: MedusaAPI;
  protected factory: ProductAssetsFactoryWithOutput<TFactory>;
  protected metadataKey = 'assets';
  protected alwaysIncludedFields = [
    '+metadata',
    '+external_id',
    '+variants.sku',
    '+variants.metadata',
  ];

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    medusa: MedusaAPI,
    factory: ProductAssetsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.medusa = medusa;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProductAssetsGetQuerySchema,
    outputSchema: z.array(ProductAssetSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getAssets(
    query: ProductAssetsGetQuery,
  ): Promise<Result<ProductAssetsFactoryOutput<TFactory>[]>> {
    const client = await this.medusa.getClient();

    const response = await client.store.product.list({
      external_id: query.forProduct.key,
      limit: 1,
      offset: 0,
      fields: this.alwaysIncludedFields.join(','),
    });

    const product = response.products?.[0];
    if (!product) {
      return success([]);
    }

    return success(this.collectAssets(product, query.forVariant?.sku, query.types));
  }

  /**
   * Gathers the assets of a product and, when a variant sku is given, of that variant. Variant assets come first, so
   * a variant entry wins over a product entry with the same key.
   */
  protected collectAssets(
    product: StoreProduct,
    variantSku: string | undefined,
    types: readonly ProductAssetType[] | undefined,
  ): ProductAssetsFactoryOutput<TFactory>[] {
    const variantMetadata =
      variantSku === undefined
        ? undefined
        : product.variants?.find((variant) => variant.sku === variantSku)?.metadata;

    const assets = [
      ...this.parseAssetsFromMetadata(variantMetadata),
      ...this.parseAssetsFromMetadata(product.metadata),
    ];

    return this.filterByTypes(this.dedupeAssets(assets), types);
  }

  /**
   * Parses the asset entries in a metadata record. The value is normally an array; a JSON string holding one is
   * accepted too, since some admin tooling stores nested metadata as text. Entries that fail validation are logged
   * and skipped, so one bad entry never hides the others.
   */
  protected parseAssetsFromMetadata(
    metadata: Record<string, unknown> | null | undefined,
  ): ProductAssetsFactoryOutput<TFactory>[] {
    const entries = this.readEntries(metadata?.[this.metadataKey]);
    const result: ProductAssetsFactoryOutput<TFactory>[] = [];
    for (const entry of entries) {
      try {
        result.push(this.factory.parseAsset(this.context, entry));
      } catch (err) {
        console.warn('Skipping invalid product asset in Medusa metadata', err);
      }
    }
    return result;
  }

  protected readEntries(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      try {
        const parsed: unknown = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn('Skipping unparsable product assets metadata in Medusa', err);
      }
    }
    return [];
  }
}
