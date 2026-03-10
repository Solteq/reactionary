import type {
  RequestContext,
  Cache,
  OrderSearchFactory,
  OrderSearchFactoryOutput,
  OrderSearchFactoryWithOutput,
  OrderSearchQueryByTerm,
  Result,
} from '@reactionary/core';
import {
  OrderSearchCapability,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import createDebug from 'debug';
import type { OrderPagedQueryResponse } from '@commercetools/platform-sdk';
import type { CommercetoolsOrderSearchFactory } from '../factories/order-search/order-search.factory.js';

const debug = createDebug('reactionary:commercetools:order-search');

export class CommercetoolsOrderSearchCapability<
  TFactory extends OrderSearchFactory = CommercetoolsOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI,
    factory: OrderSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
    this.factory = factory;
  }

  protected async getClient() {
    const client = await this.commercetools.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .me()
      .orders();
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(payload: OrderSearchQueryByTerm): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    debug('queryByTerm', payload);

    const client = await this.getClient();
    const where: string[] = [];
    if (payload.search) {
      if (payload.search.term) {
        debug('Search by term is not implemented yet in CommercetoolsOrderSearchCapability');
      }

      if (payload.search.partNumber) {
        for (const partNumber of payload.search.partNumber) {
          where.push(`lineItems(variant(sku="${partNumber}"))`);
        }
      }

      if (payload.search.user && payload.search.user.userId) {

//        where.push(`customerId="${payload.search.user.userId}"`);
      }

      if (payload.search.orderStatus) {
        const orderStatusWhere = payload.search.orderStatus.map(x => {
          let mappedStatus = 'Open';
          if (x === 'AwaitingPayment') {
            mappedStatus = `Open`
          }
          if (x === 'ReleasedToFulfillment') {
            mappedStatus = `Confirmed`
          }
          if (x === 'Shipped') {
            mappedStatus = `Complete`
          }
          if (x === 'Cancelled') {
            mappedStatus = `Cancelled`
          }
          return `orderState="${mappedStatus}"`
        }).join(' OR ');
        where.push(orderStatusWhere);
      }

      if (payload.search.startDate) {
        where.push(`createdAt >= "${payload.search.startDate}"`);
      }

      if (payload.search.endDate) {
        where.push(`createdAt <= "${payload.search.endDate}"`);
      }
    }

    const response = await client.get({
      queryArgs: {
        where: where,
        withTotal: true,
          limit: payload.search.paginationOptions.pageSize,
          offset:
            (payload.search.paginationOptions.pageNumber - 1) *
            payload.search.paginationOptions.pageSize,
      }
    }).execute();

    const responseBody = response.body;
    const result = this.factory.parseOrderSearchResult(
      this.context,
      responseBody,
      payload
    );

    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${responseBody.results.length} orders (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }

}
