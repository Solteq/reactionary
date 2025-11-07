import type {
  Inventory,
  RequestContext,
  Cache,
  InventoryQueryBySKU,
} from '@reactionary/core';
import { InventoryProvider } from '@reactionary/core';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type {
  InventoryEntry,
} from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';
export class CommercetoolsInventoryProvider<
  T extends Inventory = Inventory
> extends InventoryProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey });
  }

  public override async getBySKU(
    payload: InventoryQueryBySKU
  ): Promise<T> {
    const client = await this.getClient();

    // TODO: We can't query by supplyChannel.key, so we have to resolve it first.
    // This is probably a good candidate for internal data caching at some point.
    const channel = await client
      .channels()
      .withKey({ key: payload.fulfilmentCenter.key })
      .get()
      .execute();

    const channelId = channel.body.id;

    const remote = await client
      .inventory()
      .get({
        queryArgs: {
          where: 'sku=:sku AND supplyChannel(id=:channel)',
          'var.sku': payload.variant.sku,
          'var.channel': channelId,
          expand: 'supplyChannel'
        },
      })
      .execute();

    const result = remote.body.results[0];

    const model = this.parseSingle(result);

    return model;
  }

  protected override parseSingle(
    body: InventoryEntry
  ): T {
    const model = this.newModel();

    model.identifier = {
      variant: { sku: body.sku || '' },
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
        key: this.generateCacheKeySingle(model.identifier),
      },
      placeholder: false,
    };

    return this.assert(model);
  }
}
