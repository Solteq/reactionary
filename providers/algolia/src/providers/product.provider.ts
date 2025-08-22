import { BaseMutation, Product, ProductMutation, ProductProvider, ProductQuery, Session } from '@reactionary/core';
import { z } from 'zod';
import { AlgoliaConfiguration } from '../schema/configuration.schema';

export class AlgoliaProductProvider<
  T extends Product = Product,
  Q extends ProductQuery = ProductQuery,
  M extends ProductMutation = ProductMutation
> extends ProductProvider<T, Q, M> {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, schema: z.ZodType<T>, querySchema: z.ZodType<Q, Q>, mutationSchema: z.ZodType<M, M>, cache: any) {
    super(schema, querySchema, mutationSchema, cache);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    return [];
  }

  protected override process(mutation: BaseMutation[], session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
}
