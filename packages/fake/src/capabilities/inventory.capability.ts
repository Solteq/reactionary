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
  InventoryCapability,
  InventoryQueryBySKUSchema,
  InventorySchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import type { FakeInventoryFactory } from '../factories/inventory/inventory.factory.js';
import { calcSeed } from '../utilities/seed.js';

export class FakeInventoryCapability<
  TFactory extends InventoryFactory = FakeInventoryFactory,
> extends InventoryCapability<InventoryFactoryOutput<TFactory>> {
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
    const seedString = payload.variant.sku + (payload.fulfilmentCenter?.key ?? '');
    const seed = calcSeed(seedString);

    const generator = new Faker({
      seed,
      locale: [en, base],
    });

    // we will assume 10% of goods are out of stock
    const isOutOfStock = generator.datatype.boolean({ probability: 0.1 });

    const quantity = isOutOfStock ? 0: generator.number.int({ min: 1, max: 100 });
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
