import {
  OrderSearchCapability,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  Reactionary,
  type Cache,
  type OrderSearchFactory,
  type OrderSearchFactoryOutput,
  type OrderSearchFactoryWithOutput,
  type OrderSearchQueryByTerm,
  type OrderSearchResult,
  type OrderSearchResultItem,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';
import type { FakeOrderSearchFactory } from '../factories/order-search/order-search.factory.js';

export class FakeOrderSearchCapability<
  TFactory extends OrderSearchFactory = FakeOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected generator: Faker;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: OrderSearchFactoryWithOutput<TFactory>,
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
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public override async queryByTerm(
    payload: OrderSearchQueryByTerm,
  ): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    const items: OrderSearchResultItem[] = [];

    for (let i = 0; i < payload.search.paginationOptions.pageSize; i++) {
      items.push({
        customerName: this.generator.company.name(),
        identifier: {
          key: this.generator.string.uuid(),
        },
        inventoryStatus: 'Allocated',
        orderDate: this.generator.date.past().toString(),
        orderStatus: 'Shipped',
        totalAmount: {
          currency: 'USD',
          value: this.generator.number.int({ multipleOf: 100 }),
        },
        userId: {
          userId: '1234',
        },
      });
    }

    const totalCount = this.generator.number.int({ min: items.length, max: 200 });
    const totalPages = Math.ceil(totalCount / payload.search.paginationOptions.pageSize);

    const result = {
      identifier: payload.search,
      items,
      pageNumber: payload.search.paginationOptions.pageNumber,
      pageSize: payload.search.paginationOptions.pageSize,
      totalCount,
      totalPages,
    } satisfies OrderSearchResult;

    return success(this.factory.parseOrderSearchResult(this.context, result, payload));
  }
}
