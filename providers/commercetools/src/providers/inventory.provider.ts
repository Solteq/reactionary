import {
  BaseCachingStrategy,
  Inventory,
  InventoryProvider,
  InventoryQuery,
  RedisCache,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';
import { InventoryMutation } from 'core/src/schemas/mutations/inventory.mutation';

export class CommercetoolsInventoryProvider<
  T extends Inventory = Inventory,
  Q extends InventoryQuery = InventoryQuery,
  M extends InventoryMutation = InventoryMutation
> extends InventoryProvider<T, Q, M> {
  protected config: CommercetoolsConfiguration;
  protected cache = new RedisCache(new BaseCachingStrategy());

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    querySchema: z.ZodType<Q, Q>,
    mutationSchema: z.ZodType<M, M>
  ) {
    super(schema, querySchema, mutationSchema);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const results = [];

    for (const query of queries) {
      let result = await this.cache.get(query, session, this.schema);
      console.log('from cache: ', result);

      if (!result) {
        result = await this.get(query, session);

        this.cache.put(query, session, result);
      }

      results.push(result);
    }

    return results;
  }

  protected override process(mutations: M[], session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }

  protected async get(query: Q, session: Session): Promise<T> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity?.token
    );

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .inventory()
      .get({
        queryArgs: {
          where: 'sku=:sku',
          'var.sku': query.sku,
        },
      })
      .execute();

    const base = this.newModel();

    if (remote.body.results.length > 0) {
      const inv = remote.body.results[0];

      base.quantity = inv.availableQuantity;
    }

    return base;
  }
}
