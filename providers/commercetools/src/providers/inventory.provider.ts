import type {
  Inventory,
  RequestContext,
  Cache,
  InventoryQueryBySKU,
} from '@reactionary/core';
import { InventoryProvider } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import { CommercetoolsClient } from '../core/client.js';
import type {
  InventoryEntry,
} from '@commercetools/platform-sdk';
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

  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .inventory();
  }

  public override async getBySKU(
    payload: InventoryQueryBySKU,
    reqCtx: RequestContext
  ): Promise<T> {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);

    // TODO: We can't query by supplyChannel.key, so we have to resolve it first.
    // This is probably a good candidate for internal data caching at some point.
    const channel = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .channels()
      .withKey({ key: payload.fulfilmentCenter.key })
      .get()
      .execute();

    const channelId = channel.body.id;

    const remote = await client
      .withProjectKey({ projectKey: this.config.projectKey })
      .inventory()
      .get({
        queryArgs: {
          where: 'sku=:sku AND supplyChannel(id=:channel)',
          'var.sku': payload.sku.key,
          'var.channel': channelId,
          expand: 'supplyChannel'
        },
      })
      .execute();

    const result = remote.body.results[0];

    const model = this.parseSingle(result, reqCtx);

    return model;
  }

  protected override parseSingle(
    body: InventoryEntry,
    reqCtx: RequestContext
  ): T {
    const model = this.newModel();

    model.identifier = {
      sku: { key: body.sku || '' },
      fulfillmentCenter: {
        key: body.supplyChannel?.obj?.key || '',
      },
    };

    model.quantity = body.availableQuantity || 0;

    if (model.quantity > 0) {
      model.status = 'inStock';
    } else {
      model.status = 'outOfStock';
    }

    model.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(model.identifier, reqCtx),
      },
      placeholder: false,
    };

    return this.assert(model);
  }
}
