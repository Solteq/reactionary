import { Price, InventoryQuery, PriceProvider, Session } from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsPriceProvider<
  Q extends Price
> extends PriceProvider<Q> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<Q>) {
    super(schema);

    this.config = config;
  }

  public override async query(query: InventoryQuery, session: Session): Promise<Q> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity.token
    );

    console.log('prepare to fetch...');
    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .standalonePrices()
      .get({
        queryArgs: {
          where: 'sku=:sku',
          'var.sku': query.sku,
        }
      }).execute();

    console.log('fetched and got: ', remote);

    const base = this.base();

    if (remote.body.results.length > 0) {
        const price = remote.body.results[0];

        base.value = price.value.centAmount;
    }

    console.log('prepare to return: ', base);

    return base;
  }
}
