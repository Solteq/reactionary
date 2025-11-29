import { base, en, Faker } from '@faker-js/faker';
import type {
  Cache,
  Inventory,
  InventoryIdentifier,
  InventoryQueryBySKU,
  InventoryStatus,
  RequestContext,
} from '@reactionary/core';
import {
  InventoryProvider,
  InventoryQueryBySKUSchema,
  InventorySchema,
  Reactionary,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeInventoryProvider extends InventoryProvider {
  protected config: FakeConfiguration;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;
  }

  @Reactionary({
    inputSchema: InventoryQueryBySKUSchema,
    outputSchema: InventorySchema
  })
  public override async getBySKU(payload: InventoryQueryBySKU): Promise<Inventory> {
    // Generate a simple hash from the SKU string for seeding
    let hash = 0;
    const skuString = payload.variant.sku;
    for (let i = 0; i < skuString.length; i++) {
      hash = (hash << 5) - hash + skuString.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const identifier = {
      variant: payload.variant,
      fulfillmentCenter: payload.fulfilmentCenter,
    } satisfies InventoryIdentifier;

    const quantity = generator.number.int({ min: 0, max: 100 });

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
      meta,
      quantity,
      status
    } satisfies Inventory;

    return result;
  }
}
