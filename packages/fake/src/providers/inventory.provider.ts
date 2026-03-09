import { base, en, Faker } from '@faker-js/faker';
import type {
  Cache,
  InventoryFactory,
  InventoryFactoryOutput,
  InventoryFactoryWithOutput,
  InventoryIdentifier,
  InventoryQueryBySKU,
  InventoryStatus,
  NotFoundError,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  InventoryProvider,
  InventoryQueryBySKUSchema,
  InventorySchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeInventoryFactory } from '../factories/inventory/inventory.factory.js';

export class FakeInventoryProvider<
  TFactory extends InventoryFactory = FakeInventoryFactory,
> extends InventoryProvider<InventoryFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: InventoryFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
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
    let hash = 0;
    for (let i = 0; i < payload.variant.sku.length; i++) {
      hash = (hash << 5) - hash + payload.variant.sku.charCodeAt(i);
      hash &= hash;
    }

    const generator = new Faker({
      seed: hash || 42,
      locale: [en, base],
    });

    const quantity = generator.number.int({ min: 0, max: 100 });
    const status: InventoryStatus = quantity > 0 ? 'inStock' : 'outOfStock';

    const result = {
      identifier: {
        variant: payload.variant,
        fulfillmentCenter: payload.fulfilmentCenter,
      } satisfies InventoryIdentifier,
      quantity,
      status,
    };

    return success(this.factory.parseInventory(this.context, result));
  }
}
