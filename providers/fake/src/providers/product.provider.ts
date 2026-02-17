import {
  type ProductQueryById,
  type ProductQueryBySlug,
  type RequestContext,
  type Cache as ReactinaryCache,
  ProductProvider,
  Reactionary,
  type ProductQueryBySKU,
  type Product,
  ProductQueryByIdSchema,
  ProductSchema,
  ProductQueryBySlugSchema,
  ProductQueryBySKUSchema,
  type Result,
  error,
  success,
  type NotFoundError,
} from '@reactionary/core';
import type * as z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeProductProvider extends ProductProvider {
  protected config: FakeConfiguration;

  constructor(
    config: FakeConfiguration,
    cache: ReactinaryCache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;
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
    payload: ProductQueryById
  ): Promise<Result<Product>> {
    return success(this.parseSingle(payload.identifier.key));
  }

  @Reactionary({
    inputSchema: ProductQueryBySlugSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySlug(
    payload: ProductQueryBySlug
  ): Promise<Result<Product, NotFoundError>> {
    return success(this.parseSingle(payload.slug));
  }

  @Reactionary({
    inputSchema: ProductQueryBySKUSchema,
    outputSchema: ProductSchema,
  })
  public override async getBySKU(
    payload: ProductQueryBySKU
  ): Promise<Result<Product>> {
    return success(this.parseSingle(payload.variant.sku));
  }

  protected parseSingle(body: string): Product {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const key = body;

    // Merge the generated data into the model
    const result = {
      identifier: {
        key: key,
      },
      name: generator.commerce.productName(),
      slug: key,
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
    } satisfies Product;

    return result;
  }
}
