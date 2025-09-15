import {
  Inventory,
  InventoryProvider,
  InventoryQuery,
  Session,
  Cache,
} from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsInventoryProvider<
  T extends Inventory = Inventory
> extends InventoryProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  public override async getBySKU(
    payload: InventoryQuery,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity?.token
    );

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .inventory()
      .get({
        queryArgs: {
          where: 'sku=:sku',
          'var.sku': payload.sku,
        },
      })
      .execute();

    const base = this.newModel();

    if (remote.body.results.length > 0) {
      const inv = remote.body.results[0];
      base.quantity = inv.availableQuantity;
    }

    base.meta = {
      cache: { hit: false, key: payload.sku },
      placeholder: false
    };

    return this.assert(base);
  }
}