import type { StoreProduct, StoreProductType } from '@medusajs/types';
import type {
  Cache,
  NotFoundError,
  ProductFactory,
  ProductFactoryOutput,
  ProductFactoryWithOutput,
  ProductQueryById,
  ProductQueryBySKU,
  ProductQueryBySlug,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  error,
  ProductCapability,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import * as z from 'zod';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

import type { MedusaProductFactory } from '../factories/product/product.factory.js';
import { mapLimit } from '../utils/map-limit.js';

const debug = createDebug('reactionary:medusa:product');

/**
 * How long a fetched product type is reused. Product types change rarely, and every product needs one. The entry
 * is shared by all locales.
 */
const PRODUCT_TYPE_CACHE_TTL_SECONDS = 3600;
/**
 * How many product types are fetched at the same time for the products of one call.
 */
const PRODUCT_TYPE_CONCURRENCY = 5;

/**
 * Validates that a cached value is a Medusa product type, as far as the factory needs it to be.
 */
const MedusaProductTypeSchema = z.custom<StoreProductType>(
  (value) => typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string',
  { error: 'Expected a Medusa product type' },
);

export class MedusaProductCapability<
  TFactory extends ProductFactory = MedusaProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected alwaysIncludedFields = [
    '+metadata',
    '+categories.external_id',
    '+external_id',
    // only the id of the type, the type itself is looked up once per type, see resolveProductTypes
    '+type.id',
    '+tags.*',
  ];
  protected factory: ProductFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: ProductFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /**
   * Fetches a product type by its id with the metadata and the external id. The entry is the same for every
   * locale: the attribute definitions and the localized names are in the metadata, so the translated value of the
   * type, which is the only part that depends on the language of the request, is left out of the cache and the
   * entry is kept once per type. A failed fetch is logged and not cached, the product then keeps its machine keys.
   */
  protected async fetchProductType(id: string): Promise<StoreProductType | undefined> {
    const cacheKey = this.generateCacheKeyForQuery('medusa-product-type', { id }, 'all', 'all');
    try {
      const cached: StoreProductType | null = await this.cache.get(cacheKey, MedusaProductTypeSchema);
      if (cached) {
        return cached;
      }
      const client = await this.medusaApi.getClient();
      const response = await client.client.fetch<{ product_type: StoreProductType }>(
        `/store/product-types/${encodeURIComponent(id)}`,
        { method: 'GET', query: { fields: '+metadata,+external_id' } },
      );
      // the value is translated for the language of the first request, it must not be served to another language,
      // the name of the type comes from metadata.names and falls back to its key, see parseProductType
      const type: StoreProductType = { ...response.product_type, value: '' };
      await this.cache.put(cacheKey, type, {
        ttlSeconds: PRODUCT_TYPE_CACHE_TTL_SECONDS,
        dependencyIds: [],
      });
      return type;
    } catch (err) {
      console.error(`Unable to fetch product type ${id}, the attributes of the products keep their machine keys`, err);
      return undefined;
    }
  }

  /**
   * The products are requested with the id of their type only. The types are looked up once per distinct type
   * (at most five at a time, from the cache when possible) and put on the products, so the factory finds the full
   * type where it always did.
   */
  protected async resolveProductTypes(products: StoreProduct[]): Promise<StoreProduct[]> {
    const ids = [...new Set(products.map((product) => product.type?.id ?? product.type_id).filter((id): id is string => !!id))];
    if (ids.length === 0) {
      return products;
    }
    const fetched = await mapLimit(ids, PRODUCT_TYPE_CONCURRENCY, (id) => this.fetchProductType(id));
    const types = new Map<string, StoreProductType>();
    ids.forEach((id, position) => {
      const type = fetched[position];
      if (type) {
        types.set(id, type);
      }
    });
    return products.map((product) => {
      const id = product.type?.id ?? product.type_id;
      const type = id ? types.get(id) : undefined;
      return type ? { ...product, type } : product;
    });
  }

  protected getByIdPayload(payload: ProductQueryById) {
    return {
      external_id: payload.identifier.key,
      limit: 1,
      offset: 0,
      fields: this.alwaysIncludedFields.join(','),
    };
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getById(
    payload: ProductQueryById,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    const client = await this.medusaApi.getClient();
    if (debug.enabled) {
      debug(`Fetching product by ID: ${payload.identifier.key}`);
    }
    const response = await client.store.product.list(
      this.getByIdPayload(payload),
    );

    if (response.count === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
    const [product] = await this.resolveProductTypes([response.products[0]]);
    return success(this.factory.parseProduct(this.context, product));
  }

  protected getBySlugPayload(payload: ProductQueryBySlug) {
    return {
      handle: payload.slug,
      limit: 1,
      offset: 0,
      fields: this.alwaysIncludedFields.join(','),
    };
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getBySlug(
    payload: ProductQueryBySlug,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const client = await this.medusaApi.getClient();
    if (debug.enabled) {
      debug(`Fetching product by slug: ${payload.slug}`);
    }

    const response = await client.store.product.list(
      this.getBySlugPayload(payload),
    );

    if (debug.enabled) {
      debug(`Found ${response.count} products for slug: ${payload.slug}`);
    }

    if (response.count === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
    const [product] = await this.resolveProductTypes([response.products[0]]);
    return success(this.factory.parseProduct(this.context, product));
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    if (debug.enabled) {
      debug(
        `Fetching product by SKU: ${Array.isArray(payload) ? payload.join(', ') : payload}`,
      );
    }
    const sku = payload.variant.sku;

    const client = await this.medusaApi.getClient();
    const productResponse = await client.store.product.list({
      variants: {
        sku,
      },
      limit: 1,
      fields: this.alwaysIncludedFields.join(','),
    });
    if (productResponse.products.length === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }
    const product = productResponse.products[0];
    const variant = product.variants?.find((v) => v.sku === sku);
    if (!variant) {
      throw new Error(`Variant with SKU ${sku} not found`);
    }
    // move the hero variant to the top of the list for easier parsing later
    product.variants =
      product.variants
        ?.filter((v) => v.sku === sku)
        .concat(product.variants?.filter((v) => v.sku !== sku)) || [];

    // For simplicity, return the first matched product
    const [resolved] = await this.resolveProductTypes([product]);
    return success(this.factory.parseProduct(this.context, resolved));
  }
}
