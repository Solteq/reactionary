import { Inventory, InventoryProvider, InventoryQuery, Session } from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsInventoryProvider<
  Q extends Inventory
> extends InventoryProvider<Q> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<Q>) {
    super(schema);

    this.config = config;
  }

  public override async query(query: InventoryQuery, session: Session): Promise<Q> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity.token
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

    const base = this.base();

    if (remote.body.results.length > 0) {
        const inv = remote.body.results[0];

        base.quantity = inv.availableQuantity;
    }

    return base;
  }
}
