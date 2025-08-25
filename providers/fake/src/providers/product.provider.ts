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
        description: generator.commerce.productDescription(),
        meta: {
          cache: {
            hit: false,
            key: key,
          },
          placeholder: false
        },
        skus: [{
          identifier: {
            key: generator.commerce.isbn(),
          },
          image: {
            url: generator.image.urlPicsumPhotos({
              width: 600,
              height: 600,
            }),
            title: generator.commerce.productName(),
            height: 600,
            width: 600
          },
          images: [],
          selectionAttributes: [
            {
              id: 'color',
              name: 'Color',
              value: generator.color.human()
            },
            {
              id: 'size',
              name: 'Size',
              value: generator.helpers.arrayElement(['S', 'M', 'L', 'XL'])
            }
          ],
          technicalSpecifications: [
            {
              id: 'weight',
              name: 'Weight',
              value: `${generator.number.int({ min: 100, max: 1000 })}g`
            },
            {
              id: 'material',
              name: 'Material',
              value: generator.commerce.productMaterial()
            },
            {
              id: 'dimensions',
              name: 'Dimensions',
              value: `${generator.number.int({min: 10, max: 50})}x${generator.number.int({min: 10, max: 50})}x${generator.number.int({min: 10, max: 50})}cm`
            }
          ],
          isHero: true
        }],
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
