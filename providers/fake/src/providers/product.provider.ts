import {
  type Product,
  type ProductQueryById,
  type ProductQueryBySlug,
  type RequestContext,
  type Cache as ReactinaryCache,
  ProductProvider,
  Reactionary,
  type ProductQueryBySKU,
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { base, en, Faker } from '@faker-js/faker';

export class FakeProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: ReactinaryCache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }

  @Reactionary({})
  public override async getById(
    payload: ProductQueryById
  ): Promise<T> {
    return this.parseSingle(payload.identifier.key );
  }

  @Reactionary({})
  public override async getBySlug(
    payload: ProductQueryBySlug
  ): Promise<T> {
    return this.parseSingle(payload.slug);
  }

  @Reactionary({})
  public override async getBySKU(payload: ProductQueryBySKU): Promise<T> {
    return this.parseSingle(payload.variant.sku);
  }


  protected override parseSingle(body: string): T {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const key = body;

    // Create a model instance based on the schema
    const model = this.newModel();

    // Merge the generated data into the model
    Object.assign(model, {
      identifier: {
        key: key,
      },
      name: generator.commerce.productName(),
      slug: key,
      attributes: [],
      description: generator.commerce.productDescription(),
      image: generator.image.urlPicsumPhotos({
        width: 600,
        height: 600,
      }),
      images: [],
      meta: {
        cache: {
          hit: false,
          key: key,
        },
        placeholder: false,
      },
      skus: [],
    });

    return this.assert(model);
  }
}
