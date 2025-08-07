import { BaseMutation, Price, PriceProvider, PriceQuery, Session } from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';
import { PriceMutation } from 'core/src/schemas/mutations/price.mutation';

export class CommercetoolsPriceProvider<
  T extends Price = Price,
  Q extends PriceQuery = PriceQuery,
  M extends PriceMutation = PriceMutation
> extends PriceProvider<T, Q, M> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, querySchema: z.ZodType<Q, Q>, mutationSchema: z.ZodType<M, M>) {
    super(schema, querySchema, mutationSchema);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity?.token
    );

    const queryArgs = {
      where: 'sku in :skus',
      'var.skus': queries.map(x => x.sku.key),
    };

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .standalonePrices()
      .get({
        queryArgs,
      })
      .execute();

    const results = new Array<T>();
    
    for (const query of queries) {
        const base = this.newModel();
        const matched = remote.body.results.find(x => x.sku === query.sku.key);

        if (matched) {
          base.value = {
            cents: matched.value.centAmount,
            currency: 'USD',
          };
        }

        base.identifier = {
          sku: {
            key: query.sku.key
          }
        };

        results.push(base);
    }

    return results;
  }

  protected override process(mutation: BaseMutation[], session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }
}
