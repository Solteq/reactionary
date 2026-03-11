import type { OrderStatus as MedusaOrderStatus } from '@medusajs/types';
import type {
  Cache,
  OrderSearchFactory,
  OrderSearchFactoryOutput,
  OrderSearchFactoryWithOutput,
  OrderSearchQueryByTerm,
  RequestContext,
  Result
} from '@reactionary/core';
import {
  OrderSearchCapability,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  Reactionary,
  success
} from '@reactionary/core';
import createDebug from 'debug';
import type { MedusaAPI } from '../core/client.js';
import type { MedusaOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:medusa:order-search');

export class MedusaOrderSearchCapability<
  TFactory extends OrderSearchFactory = MedusaOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: MedusaConfiguration;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI,
    factory: OrderSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.factory = factory;

  }

  protected queryByTermPayload(payload: OrderSearchQueryByTerm): any {
    const filters: any = {};


    if (payload.search.term) {
      debug('Searching orders by term is not supported in Medusa');
    }

    if (payload.search.partNumber) {
      debug('Searching orders by part number is not supported in Medusa');
    }

    if (payload.search.startDate) {
      debug('Searching orders by start date is not supported in Medusa');
    }
    if (payload.search.endDate) {
      debug('Searching orders by end date is not supported in Medusa');
    }

    /*
    if (payload.search.user && payload.search.user.userId) {
      debug('Searching orders by customer ID is not supported in Medusa');
    } */

    const statusFilter: MedusaOrderStatus[] = (payload.search.orderStatus ?? []).map((status) => {
      let retStatus: MedusaOrderStatus = 'draft';
      if (status === 'AwaitingPayment') {
        retStatus = 'draft';
      }
      if (status === 'ReleasedToFulfillment') {
        retStatus = 'pending';
      }
      if (status === 'Shipped') {
        retStatus = 'completed';
      }
      if (status === 'Cancelled') {
        retStatus = 'canceled';
      }
      return retStatus;
    });

    return {
      status: statusFilter,
      limit: payload.search.paginationOptions.pageSize,
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,

    }
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(
    payload: OrderSearchQueryByTerm,
  ): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    debug('queryByTerm', payload);

    const medusa = await this.medusaApi.getClient();




    const response = await medusa.store.order.list(this.queryByTermPayload(payload));

    const result = this.factory.parseOrderSearchResult(this.context, response, payload);
    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.orders.length} orders (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }





}
