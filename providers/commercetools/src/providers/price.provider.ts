import { Price, PriceProvider, PriceQueryBySku, Session, Cache } from '@reactionary/core';
import z from 'zod';
import { CommercetoolsConfiguration } from '../schema/configuration.schema';
import { CommercetoolsClient } from '../core/client';

export class CommercetoolsPriceProvider<
  T extends Price = Price
> extends PriceProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(config: CommercetoolsConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async getBySKU(
    payload: PriceQueryBySku,
    session: Session
  ): Promise<T> {
    const client = new CommercetoolsClient(this.config).getClient(
      session.identity?.token
    );

    const queryArgs = {
      where: 'sku=:sku',
      'var.sku': payload.sku.key,
    };

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .standalonePrices()
      .get({
        queryArgs,
      })
      .execute();

    const base = this.newModel();
    
    if (remote.body.results.length > 0) {
      const matched = remote.body.results[0];
      base.value = {
        cents: matched.value.centAmount,
        currency: 'USD',
      };
    }

    base.identifier = {
      sku: {
        key: payload.sku.key
      }
    };

    base.meta = {
      cache: { hit: false, key: payload.sku.key },
      placeholder: false
    };

    return this.assert(base);
  }
}