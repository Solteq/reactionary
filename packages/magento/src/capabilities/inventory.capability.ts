import {
  type InventoryQueryBySKU,
  type RequestContext,
  type Cache,
  InventoryCapability,
  InventorySchema,
  InventoryQueryBySKUSchema,
  Reactionary,
  type InventoryFactory,
  type InventoryFactoryOutput,
  type InventoryFactoryWithOutput,
  type NotFoundError,
  type Result,
  success,
} from '@reactionary/core';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import type { MagentoInventoryFactory } from '../factories/inventory/inventory.factory.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:magento:inventory');

export class MagentoInventoryCapability<
  TFactory extends InventoryFactory = MagentoInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: InventoryFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: InventoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(
    payload: InventoryQueryBySKU,
  ): Promise<Result<InventoryFactoryOutput<TFactory>, NotFoundError>> {
    const sku = payload.variant.sku;
    const fulfillmentCenterKey = payload.fulfilmentCenter?.key;
    const client = await this.magentoApi.getClient();

    try {
      if (fulfillmentCenterKey) {
        const params = new URLSearchParams();
        params.set('searchCriteria[filterGroups][0][filters][0][field]', 'sku');
        params.set('searchCriteria[filterGroups][0][filters][0][value]', sku);
        params.set('searchCriteria[filterGroups][0][filters][0][condition_type]', 'eq');

        params.set('searchCriteria[filterGroups][1][filters][0][field]', 'source_code');
        params.set('searchCriteria[filterGroups][1][filters][0][value]', fulfillmentCenterKey);
        params.set('searchCriteria[filterGroups][1][filters][0][condition_type]', 'eq');

        const msiResponse = await client.store.inventory.getSourceItems(params);
        if (msiResponse?.items?.length > 0) {
          const item = msiResponse.items[0];
          return success(
            this.factory.parseInventory(this.context, {
              sku,
              fulfillmentCenterKey,
              quantity: item.quantity,
              status: item.status === 1 ? 'inStock' : 'outOfStock',
            }),
          );
        }
      }

      const statusResponse = await client.store.inventory.getStockStatus(sku);
      return success(
        this.factory.parseInventory(this.context, {
          sku,
          fulfillmentCenterKey: fulfillmentCenterKey || 'default',
          quantity: statusResponse.qty || 0,
          status: statusResponse.stock_status === 1 ? 'inStock' : 'outOfStock',
        }),
      );
    } catch (e) {
      debug('Error fetching inventory', e);
      return success(
        this.createEmptyInventory({
          variant: { sku },
          fulfillmentCenter: { key: fulfillmentCenterKey || 'default' },
        }),
      );
    }
  }
}
