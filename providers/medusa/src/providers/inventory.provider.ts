import {
  type Inventory,
  type InventoryQueryBySKU,
  type RequestContext,
  type Cache,
  InventoryProvider,
  InventorySchema,
  InventoryQueryBySKUSchema,
  Reactionary,
  type InventoryIdentifier,
  type InventoryStatus,
  type NotFoundError,
  type Result,
  success,
} from '@reactionary/core';
import type * as z from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaAdminAPI, type MedusaAPI } from '../core/client.js';
import createDebug from 'debug';

const debug = createDebug('reactionary:medusa:inventory');

export class MedusaInventoryProvider extends InventoryProvider {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI
  ) {
    super(cache, context);
    this.config = config;
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(payload: InventoryQueryBySKU): Promise<Result<Inventory, NotFoundError>> {
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
        return success(this.createEmptyInventoryResult(sku, fulfillmentCenterKey));
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
        return success(this.createEmptyInventoryResult(sku, fulfillmentCenterKey));
      }

      return success(this.parseSingle({
        sku: payload.variant.sku,
        fulfillmentCenterKey,
        quantity,
        inventoryItemId: inventoryItem.id,
      }));

    } catch (error) {
      if (debug.enabled) {
        debug(`Error fetching inventory for SKU: ${sku}`, error);
      }
      return success(this.createEmptyInventoryResult(sku, fulfillmentCenterKey));
    }
  }

  protected parseSingle(_body: unknown): Inventory {
    const { sku, fulfillmentCenterKey, quantity } = _body as {
      sku: string;
      fulfillmentCenterKey: string;
      quantity: number;
      inventoryItemId: string;
    };

    const identifier = {
      variant: {
        sku,
      },
      fulfillmentCenter: {
        key: fulfillmentCenterKey,
      },
    } satisfies InventoryIdentifier;

    let status: InventoryStatus = 'outOfStock';
    if (quantity > 0) {
      status = 'inStock';
    }

    const result = {
      identifier,
      quantity,
      status
    } satisfies Inventory;

    return result;
  }

  /**
   * Utility function to create an empty inventory result.
   * This is used when no inventory is found for a given SKU + fulfillment center combination.
   * @param sku
   * @param fulfillmentCenterKey
   * @returns
   */
  protected createEmptyInventoryResult(sku: string, fulfillmentCenterKey: string): Inventory {
    const identifier = {
      variant: { sku },
      fulfillmentCenter: { key: fulfillmentCenterKey },
    } satisfies InventoryIdentifier;

    const quantity = 0;
    const status = 'outOfStock';
    const result = {
      identifier,
      quantity,
      status
    } satisfies Inventory;

    return result;
  }

  protected override getResourceName(): string {
    return 'inventory';
  }
}
