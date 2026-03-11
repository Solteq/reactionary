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
import type { MedusaAPI } from '../core/client.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

import type { MedusaProductFactory } from '../factories/product/product.factory.js';

const debug = createDebug('reactionary:medusa:product');

export class MedusaProductCapability<
  TFactory extends ProductFactory = MedusaProductFactory,
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected alwaysIncludedFields = [
    '+metadata.*',
    '+categories.metadata.*',
    '+external_id',
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
    return success(this.factory.parseProduct(this.context, response.products[0]));
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
    return success(
      this.factory.parseProduct(this.context, response.products[0]),
    );
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
    const product = await this.medusaApi.resolveProductForSKU(sku);

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
    return success(this.factory.parseProduct(this.context, product));
  }
}
