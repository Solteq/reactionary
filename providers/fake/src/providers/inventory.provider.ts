import { base, en, Faker } from '@faker-js/faker';
import type {
  Cache,
  Inventory,
  InventoryIdentifier,
  InventoryQueryBySKU,
  RequestContext
} from '@reactionary/core';
import {
  InventoryIdentifierSchema,
  InventoryProvider
} from '@reactionary/core';
import type z from 'zod';
import type { FakeConfiguration } from '../schema/configuration.schema.js';

export class FakeInventoryProvider<
  T extends Inventory = Inventory
> extends InventoryProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: Cache, context: RequestContext) {
    super(schema, cache, context);

    this.config = config;
  }

  public override async getBySKU(
    payload: InventoryQueryBySKU
  ): Promise<T> {
    // Generate a simple hash from the SKU string for seeding
    let hash = 0;
    const skuString = payload.variant.sku;
    for (let i = 0; i < skuString.length; i++) {
      hash = ((hash << 5) - hash) + skuString.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }

    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const model = this.newModel();

    model.identifier = InventoryIdentifierSchema.parse({
      variant: payload.variant,
      fulfillmentCenter: payload.fulfilmentCenter
    } satisfies InventoryIdentifier);

    model.quantity = generator.number.int({ min: 0, max: 100 });
    if (model.quantity > 0 ) {
      model.status = 'inStock';
    } else {
      model.status = 'outOfStock';
    }


    model.meta = {
        cache: {
          hit: false,
          key: this.generateCacheKeySingle(model.identifier)
        },
        placeholder: false,
      };

    return this.assert(model);
  }
}
