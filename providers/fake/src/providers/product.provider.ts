import {
  type Cache,
  type NotFoundError,
  type ProductFactory,
  type ProductFactoryOutput,
  type ProductFactoryWithOutput,
  type ProductQueryById,
  ProductQueryByIdSchema,
  type ProductQueryBySKU,
  ProductQueryBySKUSchema,
  type ProductQueryBySlug,
  ProductQueryBySlugSchema,
  ProductProvider,
  ProductSchema,
  type RequestContext,
  type Result,
  Reactionary,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';
import type { FakeProductFactory } from '../factories/product/product.factory.js';

export class FakeProductProvider<
  TFactory extends ProductFactory = FakeProductFactory,
> extends ProductProvider<ProductFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: ProductFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: ProductFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
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
    return success(this.composeSingle(payload.identifier.key));
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySlug(
    payload: ProductQueryBySlug,
  ): Promise<Result<ProductFactoryOutput<TFactory>, NotFoundError>> {
    return success(this.composeSingle(payload.slug));
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU,
  ): Promise<Result<ProductFactoryOutput<TFactory>>> {
    return success(this.composeSingle(payload.variant.sku));
  }

  protected composeSingle(body: string): ProductFactoryOutput<TFactory> {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const result = {
      identifier: {
        key: body,
      },
      name: generator.commerce.productName(),
      slug: body,
      brand: '',
      longDescription: '',
      mainVariant: {
        barcode: '',
        ean: '',
        gtin: '',
        identifier: {
          sku: '',
        },
        images: [],
        name: '',
        options: [],
        upc: '',
      },
      description: generator.commerce.productDescription(),
      manufacturer: '',
      options: [],
      parentCategories: [],
      published: true,
      sharedAttributes: [],
      variants: [],
    };

    return this.factory.parseProduct(this.context, result);
  }
}
