import type {
  InventoryFactory,
  InventoryFactoryOutput,
  InventoryFactoryWithOutput,
  RequestContext,
  Cache,
  InventoryQueryBySKU,
  Result,
  NotFoundError,
} from '@reactionary/core';
import { InventoryCapability, InventoryQueryBySKUSchema, InventorySchema, Reactionary, success, error } from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import type { CommercetoolsInventoryFactory } from '../factories/inventory/inventory.factory.js';

export class CommercetoolsInventoryCapability<
  TFactory extends InventoryFactory = CommercetoolsInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: InventoryFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: InventoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey });
  }

  @Reactionary({
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: false,
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(payload: InventoryQueryBySKU): Promise<Result<InventoryFactoryOutput<TFactory>, NotFoundError>> {
    const client = await this.getClient();

    try {

      // TODO: We can't query by supplyChannel.key, so we have to resolve it first.
      // This is probably a good candidate for internal data caching at some point.
      const channelId = await this.commercetools.resolveChannelIdByKey(payload.fulfilmentCenter.key);

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

      const model = this.factory.parseInventory(this.context, result);


      return success(model);
    } catch (err) {
      console.error('Error fetching inventory by SKU and Fulfillment Center:', error, payload);
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload
      });
    }
  }

}
