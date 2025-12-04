import type {
  Inventory,
  RequestContext,
  Cache,
  InventoryQueryBySKU,
  InventoryIdentifier,
  InventoryStatus,
  Result,
  NotFoundError,
} from '@reactionary/core';
import { InventoryProvider, InventoryQueryBySKUSchema, InventorySchema, Reactionary, success, error } from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { InventoryEntry } from '@commercetools/platform-sdk';
import type { CommercetoolsClient } from '../core/client.js';

export class CommercetoolsInventoryProvider extends InventoryProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(payload: InventoryQueryBySKU): Promise<Result<Inventory, NotFoundError>> {
    const client = await this.getClient();

    try {

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
            expand: 'supplyChannel',
          },
        })
        .execute();

      const result = remote.body.results[0];

      const model = this.parseSingle(result);


      return success(model);
    } catch (err) {
      console.error('Error fetching inventory by SKU and Fulfillment Center:', error, payload);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload
      });
    }
  }

  protected parseSingle(body: InventoryEntry): Inventory {
    const identifier = {
      variant: { sku: body.sku || '' },
      fulfillmentCenter: {
        key: body.supplyChannel?.obj?.key || '',
      },
    } satisfies InventoryIdentifier;

    const quantity = body.availableQuantity || 0;
    let status: InventoryStatus = 'outOfStock';

    if (quantity > 0) {
      status = 'inStock';
    }

    const meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(identifier),
      },
      placeholder: false,
    };

    const result = {
      identifier,
      quantity,
      status,
      meta
    } satisfies Inventory;

    return result;
  }
}
