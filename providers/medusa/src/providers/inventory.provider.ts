import {
  type Inventory,
  type InventoryQueryBySKU,
  type RequestContext,
  type Cache,
  InventoryProvider,
  InventorySchema,
  InventoryQueryBySKUSchema,
  Reactionary,
} from '@reactionary/core';
import type z from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaAdminClient, type MedusaClient } from '../core/client.js';
import createDebug from 'debug';
import type { AdminInventoryLevelResponse } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:inventory');

export class MedusaInventoryProvider<
  T extends Inventory = Inventory
> extends InventoryProvider<T> {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    public client: MedusaClient
  ) {
    super(schema, cache, context);
    this.config = config;
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema,
  })
  public override async getBySKU(payload: InventoryQueryBySKU): Promise<T> {
    const sku = payload.variant.sku;
    const fulfillmentCenterKey = payload.fulfilmentCenter.key;

    if (debug.enabled) {
      debug(`Fetching inventory for SKU: ${sku}, fulfillment center: ${fulfillmentCenterKey}`);
    }

    try {
      const adminClient = await (new MedusaAdminClient(this.config, this.context).getClient());

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
        return this.createEmptyInventoryResult(sku, fulfillmentCenterKey);
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
        return this.createEmptyInventoryResult(sku, fulfillmentCenterKey);
      }

      return this.parseSingle({
        sku: payload.variant.sku,
        fulfillmentCenterKey,
        quantity,
        inventoryItemId: inventoryItem.id,
      });

    } catch (error) {
      if (debug.enabled) {
        debug(`Error fetching inventory for SKU: ${sku}`, error);
      }
      return this.createEmptyInventoryResult(sku, fulfillmentCenterKey);
    }
  }

  protected override parseSingle(_body: unknown): T {
    const { sku, fulfillmentCenterKey, quantity } = _body as {
      sku: string;
      fulfillmentCenterKey: string;
      quantity: number;
      inventoryItemId: string;
    };

    const model = this.newModel();

    model.identifier = {
      variant: {
        sku,
      },
      fulfillmentCenter: {
        key: fulfillmentCenterKey,
      },
    };

    model.sku = sku;
    model.quantity = quantity;

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

  /**
   * Utility function to create an empty inventory result.
   * This is used when no inventory is found for a given SKU + fulfillment center combination.
   * @param sku
   * @param fulfillmentCenterKey
   * @returns
   */
  protected createEmptyInventoryResult(sku: string, fulfillmentCenterKey: string): T {
    const model = this.newModel();

    model.identifier = {
      variant: { sku },
      fulfillmentCenter: { key: fulfillmentCenterKey },
    };

    model.sku = sku;
    model.quantity = 0;
    model.status = 'outOfStock';

    model.meta = {
      cache: {
        hit: false,
        key: this.generateCacheKeySingle(model.identifier),
      },
      placeholder: true,
    };

    return this.assert(model);
  }

  protected override getResourceName(): string {
    return 'inventory';
  }
}
