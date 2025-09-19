import type {
  Inventory,
  Session, RequestContext,
  Cache,
  InventoryQueryBySKU
} from '@reactionary/core';
import {
  InventoryProvider
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema';
import { base, en, Faker } from '@faker-js/faker';

export class FakeInventoryProvider<
  T extends Inventory = Inventory
> extends InventoryProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);

    this.config = config;
  }

  public override async getBySKU(
    payload: InventoryQueryBySKU,
    _reqCtx: RequestContext
  ): Promise<T> {
    // Generate a simple hash from the SKU string for seeding
    let hash = 0;
    const skuString = payload.sku.key;
    for (let i = 0; i < skuString.length; i++) {
      hash = ((hash << 5) - hash) + skuString.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const model = this.newModel();

    model.identifier = {
      sku: payload.sku,
      fulfillmentCenter: payload.fulfilmentCenter
    };
    model.sku = skuString;

    model.quantity = generator.number.int({ min: 0, max: 100 });
    if (model.quantity > 0 ) {
      model.status = 'inStock';
    } else {
      model.status = 'outOfStock';
    }


    model.meta = {
        cache: {
          hit: false,
          key: this.generateCacheKeySingle(model.identifier, _reqCtx)
        },
        placeholder: false,
      };

    return this.assert(model);
  }
}
