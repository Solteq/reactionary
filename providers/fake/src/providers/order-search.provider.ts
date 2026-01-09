import {
  OrderSearchProvider,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  Reactionary,
  type Cache,
  type OrderSearchQueryByTerm,
  type OrderSearchResult,
  type RequestContext,
  type Result,
  success,
  type OrderSearchResultItem,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';

export class FakeOrderSearchProvider extends OrderSearchProvider {
  protected config: FakeConfiguration;
  protected generator: Faker;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;

    this.generator = new Faker({
      locale: [en, base],
      seed: config.seeds.product,
    });
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public override async queryByTerm(
    payload: OrderSearchQueryByTerm
  ): Promise<Result<OrderSearchResult>> {
    const items = new Array<OrderSearchResultItem>();

    for (let i = 0; i < payload.search.paginationOptions.pageSize; i++) {
        items.push({
            customerName: this.generator.company.name(),
            identifier: {
                key: this.generator.string.uuid()
            },
            inventoryStatus: 'Allocated',
            orderDate: this.generator.date.past().toString(),
            orderStatus: 'Shipped',
            totalAmount: {
                currency: 'USD',
                value: this.generator.number.int({ multipleOf: 100 })
            },
            userId: {
                userId: '1234'
            }
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
        totalPages
    } satisfies OrderSearchResult;

    return success(result);
  }
}
