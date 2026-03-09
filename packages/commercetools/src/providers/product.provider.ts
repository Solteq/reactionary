import {
  ProductProvider,
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

export class CommercetoolsProductProvider<
  TFactory extends ProductFactory = CommercetoolsProductFactory
> extends ProductProvider<ProductFactoryOutput<TFactory>> {
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

    const value = this.factory.parseProduct(this.context, remote.body);

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

    const remote = await client
      .get({
        queryArgs: {
          // FIXME: Hardcoded locale
          where: 'slug(en = :slug)',
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
    const result = this.factory.parseProduct(this.context, remote.body.results[0]);

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

    // PAIN: the lack of knowing the non-generic type signature of the factory (the scopedown to CT Product Provider)
    // this is due to the Typescript construct for ProductFactoryOutput<TFactory>
    const result = this.factory.parseProduct(this.context, remote.body.results[0]);

    return success(result);
  }
}
