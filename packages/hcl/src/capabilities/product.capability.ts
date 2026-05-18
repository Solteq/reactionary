import {
  ProductCapability,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  error,
  success,
  type Cache,
  type NotFoundError,
  type ProductFactory,
  type ProductFactoryOutput,
  type ProductFactoryWithOutput,
  type ProductQueryById,
  type ProductQueryBySKU,
  type ProductQueryBySlug,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclProductFactory } from '../factories/product/product.factory.js';
import type { HclProductResponse } from '../schema/hcl.schema.js';
import { getLocaleParams } from '../core/locale-params.js';

export class HclProductCapability<
  TFactory extends ProductFactory = HclProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected readonly config: HclConfiguration,
    protected readonly client: HclClient,
    protected readonly factory: ProductFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getById(
    payload: ProductQueryById,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const { langId, currency } = getLocaleParams(this.config, this.context);
    const response = await this.client.findProducts({
      partNumber: [payload.identifier.key],
      profileName: this.config.profiles.product,
      langId,
      currency,
    });

    const products = response.contents ?? response.catalogEntryView ?? [];
    const data = products[0];

    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.identifier,
      });
    }

    const value = this.factory.parseProduct(
      this.context,
      await this.withResolvedParentCategories(data, langId),
    );
    return success(value);
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getBySlug(
    payload: ProductQueryBySlug,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const { langId, currency } = getLocaleParams(this.config, this.context);
    // Resolve the URL slug to a partNumber via the HCL URL token API.
    // tokenExternalValue holds the partNumber for ProductToken entries.
    const token = await this.client.resolveSlug(payload.slug, langId);

    if (
      !token ||
      token.tokenName !== 'ProductToken' ||
      !token.tokenExternalValue
    ) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }

    const response = await this.client.findProducts({
      partNumber: [token.tokenExternalValue],
      profileName: this.config.profiles.product,
      langId,
      currency,
    });

    const products = response.contents ?? response.catalogEntryView ?? [];
    const data = products[0];

    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }

    const value = this.factory.parseProduct(
      this.context,
      await this.withResolvedParentCategories(data, langId),
    );
    return success(value);
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const { langId, currency } = getLocaleParams(this.config, this.context);
    const response = await this.client.findProducts({
      partNumber: [payload.variant.sku],
      profileName: this.config.profiles.product,
      langId,
      currency,
    });

    const products = response.contents ?? response.catalogEntryView ?? [];
    const data = products[0];

    if (!data) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.variant,
      });
    }

    const value = this.factory.parseProduct(
      this.context,
      await this.withResolvedParentCategories(data, langId),
    );
    return success(value);
  }

  /**
   * Resolves `parentCatalogGroupID` path strings (e.g. "/10505/10507") to external
   * category identifiers (e.g. "LivingRoomFurniture") so the factory receives
   * human-readable keys rather than internal uniqueIDs.
   */
  protected async withResolvedParentCategories(
    data: HclProductResponse,
    langId: string,
  ): Promise<HclProductResponse> {
    const rawIds = Array.isArray(data.parentCatalogGroupID)
      ? data.parentCatalogGroupID
      : data.parentCatalogGroupID
        ? [data.parentCatalogGroupID]
        : [];

    // Each entry is a path like "/10505/10507" — the last segment is the
    // direct parent category uniqueID.
    const uniqueIds = [
      ...new Set(
        rawIds
          .map((p) => p.split('/').filter(Boolean).at(-1))
          .filter((id): id is string => id !== undefined),
      ),
    ];

    if (uniqueIds.length === 0) return data;

    const catResp = await this.client.findCategories({ id: uniqueIds, langId });
    const idToIdentifier = new Map(
      (catResp.contents ?? []).map((c) => [c.uniqueID, c.identifier]),
    );

    const resolvedIds = uniqueIds.map((id) => idToIdentifier.get(id) ?? id);
    return { ...data, parentCatalogGroupID: resolvedIds };
  }
}
