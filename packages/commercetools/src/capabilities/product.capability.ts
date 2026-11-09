import {
  ProductCapability,
  ProductQueryByIdSchema,
  ProductQueryBySKUSchema,
  ProductQueryBySlugSchema,
  ProductSchema,
  Reactionary,
  success,
  error,
  type ProductFactory,
  type ProductFactoryOutput,
  type ProductFactoryWithOutput,
} from '@reactionary/core';
import * as z from 'zod';
import type { ProductProjection, ProductType as CTProductType } from '@commercetools/platform-sdk';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  ProductQueryById,
  ProductQueryBySKU,
  ProductQueryBySlug,
  RequestContext,
  Result,
} from '@reactionary/core';
import type { Cache } from '@reactionary/core';
import type { CommercetoolsAPI } from '../core/client.js';
import type { NotFoundError } from '@reactionary/core';
import type { CommercetoolsProductFactory } from '../factories/product/product.factory.js';
import { getLanguageCodeFromLocale } from '../core/locale-utils.js';

/**
 * How long a fetched product type is reused. Product types change rarely, and every product needs one.
 */
const PRODUCT_TYPE_CACHE_TTL_SECONDS = 3600;

/**
 * Validates that a cached value is a commercetools product type, as far as the factory needs it to be.
 */
const CommercetoolsProductTypeSchema = z.custom<CTProductType>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string',
  { error: 'Expected a commercetools product type' },
);

export class CommercetoolsProductCapability<
  TFactory extends ProductFactory = CommercetoolsProductFactory
> extends ProductCapability<ProductFactoryOutput<TFactory>> {
  constructor(
    cache: Cache,
    context: RequestContext,
    protected config: CommercetoolsConfiguration,
    protected commercetools: CommercetoolsAPI,
    protected factory: ProductFactoryWithOutput<TFactory>
  ) {
    super(cache, context);
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .productProjections();
  }

  /**
   * The factory labels attributes from the product type. The type is fetched once per product type
   * and reused from the capability cache, and handed to the factory as the expanded reference.
   * Failing to get the type never fails the product, the attributes then keep their machine names.
   */
  protected async withProductType(projection: ProductProjection): Promise<ProductProjection> {
    if (projection.productType.obj) {
      return projection;
    }
    const id = projection.productType.id;
    const cacheKey = this.generateCacheKeyForQuery('commercetools-product-type', { id }, 'all', 'all');
    try {
      let productType: CTProductType | null = await this.cache.get(cacheKey, CommercetoolsProductTypeSchema);
      if (!productType) {
        const client = (await this.commercetools.getClient()).withProjectKey({ projectKey: this.config.projectKey });
        productType = (await client.productTypes().withId({ ID: id }).get().execute()).body;
        await this.cache.put(cacheKey, productType, {
          ttlSeconds: PRODUCT_TYPE_CACHE_TTL_SECONDS,
          dependencyIds: [],
        });
      }
      return { ...projection, productType: { ...projection.productType, obj: productType } };
    } catch (err) {
      console.error(`Unable to fetch product type ${id}, the attributes of the product keep their machine names`, err);
      return projection;
    }
  }

  @Reactionary({
    inputSchema: ProductQueryByIdSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true
  })
  public override async getById(
    payload: ProductQueryById
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    const client = await this.getClient();
    const remote = await client
      .withKey({ key: payload.identifier.key })
      .get()
      .execute();

    const value = this.factory.parseProduct(this.context, await this.withProductType(remote.body));

    return success(value);
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true
  })
  public override async getBySlug(
    payload: ProductQueryBySlug
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();
    const localeStr = getLanguageCodeFromLocale(this.context.languageContext.locale) || 'en';

    const remote = await client
      .get({
        queryArgs: {
          where: `slug(${localeStr} = :slug)`,
          'var.slug': payload.slug,
        },
      })
      .execute();

    if (remote.body.count === 0) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload.slug,
      });
    }
    const result = this.factory.parseProduct(this.context, await this.withProductType(remote.body.results[0]));

    return success(result);
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true
  })
  public override async getBySKU(
    payload: ProductQueryBySKU
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    const client = await this.getClient();

    const remote = await client
      .get({
        queryArgs: {
          staged: false,
          limit: 1,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [payload].map((p) => p.variant.sku),
        },
      })
      .execute();

    // PAIN: the lack of knowing the non-generic type signature of the factory (the scopedown to the CT product capability)
    // this is due to the Typescript construct for ProductFactoryOutput<TFactory>
    const result = this.factory.parseProduct(this.context, await this.withProductType(remote.body.results[0]));

    return success(result);
  }
}
