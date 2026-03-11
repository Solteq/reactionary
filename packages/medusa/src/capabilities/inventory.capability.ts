import {
  type Cache,
  InventoryCapability,
  type InventoryFactory,
  type InventoryFactoryOutput,
  type InventoryFactoryWithOutput,
  type InventoryQueryBySKU,
  InventoryQueryBySKUSchema,
  InventorySchema,
  type NotFoundError,
  Reactionary,
  type RequestContext,
  type Result,
  success,
  error
} from '@reactionary/core';
import createDebug from 'debug';
import { MedusaAdminAPI, type MedusaAPI } from '../core/client.js';
import type { MedusaInventoryFactory } from '../factories/inventory/inventory.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:inventory');

export class MedusaInventoryCapability<
  TFactory extends InventoryFactory = MedusaInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: InventoryFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
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
    const fulfillmentCenterKey = payload.fulfilmentCenter.key;

    if (debug.enabled) {
      debug(`Fetching inventory for SKU: ${sku}, fulfillment center: ${fulfillmentCenterKey}`);
    }

    try {
      const adminClient = await (new MedusaAdminAPI(this.config, this.context).getClient());

      // Get inventory items for this variant
      const inventoryResponse = await adminClient.admin.inventoryItem.list({
        sku: [sku],
        limit: 1,
        offset: 0
      })

      if (!inventoryResponse.inventory_items || inventoryResponse.inventory_items.length === 0) {
        if (debug.enabled) {
          debug(`No inventory items found for SKU: ${sku}`);
        }
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.variant });
      }

      const inventoryItem = inventoryResponse.inventory_items[0];

      // Get inventory levels for this item and location
      // In Medusa, we need to find the stock location that matches our fulfillment center key
      const locationsResponse = await adminClient.admin.stockLocation.list({
        name: fulfillmentCenterKey,
        limit: 1,
        offset: 0
      });

      let quantity = 0;
      let locationFound = false;

      if (locationsResponse.stock_locations && locationsResponse.stock_locations.length > 0) {
        const location = locationsResponse.stock_locations[0];
        locationFound = true;

        // Get inventory level for this item at this location
        const levelsResponse = await adminClient.admin.inventoryItem.listLevels(inventoryItem.id, {
          location_id: [location.id],
        });

        if (levelsResponse.inventory_levels && levelsResponse.inventory_levels.length > 0) {
          const level = levelsResponse.inventory_levels[0];
          quantity = level.stocked_quantity - level.reserved_quantity;
        }
      }

      if (!locationFound) {
        if (debug.enabled) {
          debug(`No stock location found with name: ${fulfillmentCenterKey}`);
        }
        return error<NotFoundError>({ type: 'NotFound', identifier: payload.fulfilmentCenter });
      }

      return success(this.factory.parseInventory(this.context, {
        sku: payload.variant.sku,
        fulfillmentCenterKey,
        quantity,
        inventoryItemId: inventoryItem.id,
      }));

    } catch (err) {
      if (debug.enabled) {
        debug(`Error fetching inventory for SKU: ${sku}`, err);
      }
      return error<NotFoundError>({ type: 'NotFound', identifier: payload.variant });
    }
  }

}
