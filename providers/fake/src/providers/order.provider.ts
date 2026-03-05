import {
  OrderProvider,
  OrderQueryByIdSchema,
  OrderSchema,
  Reactionary,
  success,
  type Cache,
  type NotFoundError,
  type Order,
  type OrderFactory,
  type OrderFactoryOutput,
  type OrderFactoryWithOutput,
  type OrderQueryById,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';
import type { FakeOrderFactory } from '../factories/order/order.factory.js';

export class FakeOrderProvider<
  TFactory extends OrderFactory = FakeOrderFactory,
> extends OrderProvider<OrderFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected generator: Faker;
  protected factory: OrderFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: OrderFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: OrderQueryByIdSchema,
    outputSchema: OrderSchema,
  })
  public override async getById(
    payload: OrderQueryById,
  ): Promise<Result<OrderFactoryOutput<TFactory>, NotFoundError>> {
    const order = {
      identifier: payload.order,
      inventoryStatus: 'Allocated',
      items: [],
      orderStatus: 'Shipped',
      paymentInstructions: [],
      userId: {
        userId: '1234',
      },
      price: {
        grandTotal: {
          currency: 'USD',
          value: this.generator.number.float({ min: 100, max: 10000, multipleOf: 25 }),
        },
        totalDiscount: {
          currency: 'USD',
          value: this.generator.number.float({ min: 100, max: 10000, multipleOf: 25 }),
        },
        totalProductPrice: {
          currency: 'USD',
          value: this.generator.number.float({ min: 100, max: 10000, multipleOf: 25 }),
        },
        totalShipping: {
          currency: 'USD',
          value: this.generator.number.float({ min: 100, max: 10000, multipleOf: 25 }),
        },
        totalSurcharge: {
          currency: 'USD',
          value: this.generator.number.float({ min: 100, max: 10000, multipleOf: 25 }),
        },
        totalTax: {
          currency: 'USD',
          value: this.generator.number.float({ min: 100, max: 10000, multipleOf: 25 }),
        },
      },
    } satisfies Order;

    return success(this.factory.parseOrder(this.context, order));
  }
}
