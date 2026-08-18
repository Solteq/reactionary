import type {
  Cache,
  OrderSearchFactory,
  OrderSearchFactoryOutput,
  OrderSearchFactoryWithOutput,
  OrderSearchQueryByTerm,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  OrderSearchCapability,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import type { MagentoOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';

const debug = createDebug('reactionary:magento:order-search');

export class MagentoOrderSearchCapability<
  TFactory extends OrderSearchFactory = MagentoOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: OrderSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  protected emptyResult(payload: OrderSearchQueryByTerm) {
    return this.factory.parseOrderSearchResult(
      this.context,
      {
        items: [],
        total_count: 0,
        search_criteria: {
          page_size: payload.search.paginationOptions.pageSize,
          current_page: payload.search.paginationOptions.pageNumber,
        },
      },
      payload,
    );
  }

  protected async resolveCustomerId(): Promise<string | null> {
    try {
      const me = await this.magentoApi.getMe();
      return me?.id !== undefined ? String(me.id) : null;
    } catch (err) {
      debug('resolveCustomerId: not authenticated: %O', err);
      return null;
    }
  }

  protected buildSearchParams(
    payload: OrderSearchQueryByTerm,
    customerId: string,
  ): URLSearchParams {
    const params = new URLSearchParams();
    let group = 0;

    const addFilter = (field: string, value: string, condition = 'eq') => {
      params.set(
        `searchCriteria[filterGroups][${group}][filters][0][field]`,
        field,
      );
      params.set(
        `searchCriteria[filterGroups][${group}][filters][0][value]`,
        value,
      );
      params.set(
        `searchCriteria[filterGroups][${group}][filters][0][condition_type]`,
        condition,
      );
      group += 1;
    };

    addFilter('customer_id', customerId);

    if (payload.search.term) {
      addFilter('increment_id', `%${payload.search.term}%`, 'like');
    }

    if (payload.search.orderStatus && payload.search.orderStatus.length > 0) {
      const magentoStatuses = Array.from(
        new Set(
          payload.search.orderStatus.flatMap((status) => {
            switch (status) {
              case 'ReleasedToFulfillment':
                return ['processing'];
              case 'Shipped':
                return ['complete', 'closed'];
              case 'Cancelled':
                return ['canceled'];
              default:
                return ['pending'];
            }
          }),
        ),
      );
      addFilter('status', magentoStatuses.join(','), 'in');
    }

    if (payload.search.startDate) {
      addFilter('created_at', payload.search.startDate, 'gteq');
    }
    if (payload.search.endDate) {
      addFilter('created_at', payload.search.endDate, 'lteq');
    }

    params.set(
      'searchCriteria[pageSize]',
      String(payload.search.paginationOptions.pageSize),
    );
    params.set(
      'searchCriteria[currentPage]',
      String(payload.search.paginationOptions.pageNumber),
    );
    params.set('searchCriteria[sortOrders][0][field]', 'created_at');
    params.set('searchCriteria[sortOrders][0][direction]', 'DESC');

    return params;
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(
    payload: OrderSearchQueryByTerm,
  ): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    const customerId = await this.resolveCustomerId();

    if (!customerId) {
      // Anonymous/guest users have no order history scope.
      return success(this.emptyResult(payload));
    }

    let response = await this.magentoApi.searchOrders(
      this.buildSearchParams(payload, customerId),
    );

    if (payload.search.partNumber && payload.search.partNumber.length > 0) {
      response = this.filterByPartNumber(response, payload.search.partNumber);
    }

    const result = this.factory.parseOrderSearchResult(
      this.context,
      response,
      payload,
    );
    return success(result);
  }

  protected filterByPartNumber(response: any, partNumbers: string[]) {
    const items = (response.items ?? []).filter((order: any) => {
      const skus = (order.items ?? []).map((i: any) => i.sku);
      return partNumbers.every((pn) => skus.includes(pn));
    });
    return {
      ...response,
      items,
      total_count: items.length,
    };
  }
}
