import {
  Product,
  ProductProvider,
  ProductQueryById,
  ProductQueryBySlug,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { base, en, Faker } from '@faker-js/faker';
import { traced } from '@reactionary/otel';

export class FakeProductProvider<
  T extends Product = Product
> extends ProductProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: any) {
    super(schema, cache);

    this.config = config;
  }

  @traced()
  public override async getById(
    payload: ProductQueryById,
    session: Session
  ): Promise<T> {
    return this.parseSingle(payload);
  }

  public override async getBySlug(
    payload: ProductQueryBySlug,
    session: Session
  ): Promise<T> {
    return this.parseSingle(payload);
  }

  protected override parseSingle(body: ProductQueryById | ProductQueryBySlug): T {
    const generator = new Faker({
      seed: 42,
      locale: [en, base],
    });

    const key = body.slug || body.id;

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
