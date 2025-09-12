import {
  BaseMutation,
  Product,
  ProductMutation,
  ProductProvider,
  ProductQuery,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { base, en, Faker } from '@faker-js/faker';

export class FakeProductProvider<
  T extends Product = Product,
  Q extends ProductQuery = ProductQuery,
  M extends ProductMutation = ProductMutation
> extends ProductProvider<T, Q, M> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, querySchema: z.ZodType<Q, Q>, mutationSchema: z.ZodType<M, M>, cache: any) {
    super(schema, querySchema, mutationSchema, cache);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const results = new Array<T>();

    for (const query of queries) {

      if (query.query === 'id') {
        console.log(query.id);
      }

      const generator = new Faker({
        seed: 42,
        locale: [en, base],
      });

      const key = (query.id as string) || generator.commerce.isbn();
      const slug = (query.slug as string) || generator.lorem.slug();

      const product: Product = {
        identifier: {
          key: key,
        },
        name: generator.commerce.productName(),
        slug: slug,
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
          placeholder: false
        },
        skus: [],
      };

      results.push(product as T);
    }

    return results;
  }

  protected override process(
    mutation: BaseMutation[],
    session: Session
  ): Promise<T> {
    throw new Error('Method not implemented.');
  }
}
