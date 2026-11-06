import * as z from 'zod';
import {
  ProductAssetSchema,
  ProductAssetsCapability,
  ProductAssetsGetQuerySchema,
  Reactionary,
  success,
  type Cache,
  type ProductAssetType,
  type ProductAssetsFactory,
  type ProductAssetsFactoryOutput,
  type ProductAssetsFactoryWithOutput,
  type ProductAssetsGetQuery,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclClient } from '../core/client.js';
import type { HclProductAssetsFactory } from '../factories/product-assets/product-assets.factory.js';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type {
  HclAttachment,
  HclProductQueryResponse,
  HclProductResponse,
} from '../schema/hcl.schema.js';

/**
 * Attachment usage identifiers created by `setup/product-asset-usages.changelog.xml`, mapped to their asset type.
 * `productAssets.usageTypeMap` in the configuration adds to or overrides these.
 */
export const DEFAULT_ATTACHMENT_USAGE_TYPE_MAP: Readonly<Record<string, ProductAssetType>> = {
  MANUAL: 'manual',
  USER_GUIDE: 'user-guide',
  INSTALLATION_GUIDE: 'installation-guide',
  DATASHEET: 'datasheet',
  CERTIFICATE: 'certificate',
  WARRANTY: 'warranty',
  SAFETY_DATA_SHEET: 'safety-data-sheet',
  ENERGY_LABEL: 'energy-label',
  PRODUCT_FICHE: 'product-fiche',
  VIDEO: 'video',
  MODEL_3D: '3d-model',
  OTHER_ASSET: 'other',
};

/**
 * Reads product assets from the HCL Commerce attachments of the product and, when a variant is requested, of the
 * SKU with that part number. Only attachments whose usage is mapped to an asset type are returned: HCL uses
 * attachments for other things too, such as images.
 */
export class HclProductAssetsCapability<
  TFactory extends ProductAssetsFactory = HclProductAssetsFactory,
> extends ProductAssetsCapability<ProductAssetsFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: ProductAssetsFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ProductAssetsGetQuerySchema,
    outputSchema: z.array(ProductAssetSchema),
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    // HCL returns the attachment assets, and their names, for the request language
    localeDependentCaching: true,
  })
  public override async getAssets(
    query: ProductAssetsGetQuery,
  ): Promise<Result<ProductAssetsFactoryOutput<TFactory>[]>> {
    const response = await this.client.callGet<HclProductQueryResponse>(
      this.getProductsUrl(),
      this.getProductsParams(query.forProduct.key),
    );

    const product = (response.contents ?? response.catalogEntryView ?? [])[0];
    if (!product) {
      return success([]);
    }

    return success(this.collectAssets(product, query.forVariant?.sku, query.types));
  }

  /**
   * Gathers the attachments of the product and of the requested SKU. SKU assets come first, so a SKU asset wins over
   * a product asset with the same key.
   */
  protected collectAssets(
    product: HclProductResponse,
    variantSku: string | undefined,
    types: readonly ProductAssetType[] | undefined,
  ): ProductAssetsFactoryOutput<TFactory>[] {
    const sku =
      variantSku === undefined || product.partNumber === variantSku
        ? undefined
        : product.items?.find((item) => item.partNumber === variantSku);

    const assets = [
      ...this.parseAttachments(sku?.attachments),
      ...this.parseAttachments(product.attachments),
    ];

    return this.filterByTypes(this.dedupeAssets(assets), types);
  }

  /** Attachments with an unmapped usage are ignored; invalid ones are logged and skipped. */
  protected parseAttachments(
    attachments: readonly HclAttachment[] | undefined,
  ): ProductAssetsFactoryOutput<TFactory>[] {
    const typeMap = this.usageTypeMap;
    const result: ProductAssetsFactoryOutput<TFactory>[] = [];
    for (const attachment of attachments ?? []) {
      if (!attachment.usage || !Object.hasOwn(typeMap, attachment.usage)) {
        continue;
      }
      const { type, vendorType } = this.mapVendorType(attachment.usage, typeMap);
      const url = this.toAbsoluteUrl(attachment.attachmentAssetPath);
      if (!url) {
        console.warn(`Skipping HCL attachment ${attachment.attachmentAssetID}: no usable asset url`);
        continue;
      }
      try {
        result.push(
          this.factory.parseAsset(this.context, {
            attachment,
            url,
            type,
            vendorType: vendorType ?? attachment.usage,
          }),
        );
      } catch (err) {
        console.warn(`Skipping invalid HCL attachment ${attachment.attachmentAssetID}`, err);
      }
    }
    return result;
  }

  protected get usageTypeMap(): Readonly<Record<string, ProductAssetType>> {
    return { ...DEFAULT_ATTACHMENT_USAGE_TYPE_MAP, ...this.config.productAssets?.usageTypeMap };
  }

  /** Absolute paths are kept; relative ones are resolved against the configured asset base url, else apiUrl. */
  protected toAbsoluteUrl(path: string | undefined): string | undefined {
    if (!path) {
      return undefined;
    }
    const base = this.config.productAssets?.assetBaseUrl ?? this.config.apiUrl;
    try {
      return new URL(path, base).toString();
    } catch {
      return undefined;
    }
  }

  protected getProductsUrl(): string {
    return `${this.client.catalogBaseUrl}/api/v2/products`;
  }

  protected getProductsParams(partNumber: string): URLSearchParams {
    const params = new URLSearchParams();
    params.set('storeId', this.config.storeId);
    params.append('partNumber', partNumber);
    params.set('profileName', this.config.profiles.product);
    return params;
  }
}
