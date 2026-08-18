import {
  type Cache,
  OrderSearchCapability,
  type OrderSearchFactory,
  type OrderSearchFactoryOutput,
  type OrderSearchFactoryWithOutput,
  type OrderSearchQueryByTerm,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  type OrderStatus,
  Reactionary,
  type RequestContext,
  type Result,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { HclConfiguration } from '../schema/configuration.schema.js';
import type { HclClient } from '../core/client.js';
import type { HclOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { HclWcsOrderListResponse } from '../schema/hcl.schema.js';

const debug = createDebug('reactionary:hcl:order-search');

/** All WCS non-pending statuses used when no status filter is provided. */
const ALL_HISTORY_STATUSES = 'C,S,X,R,D,M,G,F';

/** Maps a core OrderStatus to the WCS status code(s) for the byStatus endpoint. */
function coreStatusToWcs(status: OrderStatus): string {
  switch (status) {
    case 'Shipped':
      return 'S';
    case 'Cancelled':
      return 'X,R,D';
    case 'ReleasedToFulfillment':
      return 'M,G,F';
    case 'AwaitingPayment':
      return 'C';
  }
}

export class HclOrderSearchCapability<
  TFactory extends OrderSearchFactory = HclOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: HclConfiguration;
  protected client: HclClient;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  constructor(
    cache: Cache,
    context: RequestContext,
    config: HclConfiguration,
    client: HclClient,
    factory: OrderSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.client = client;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(
    payload: OrderSearchQueryByTerm,
  ): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    const { pageSize, pageNumber } = payload.search.paginationOptions;

    const wcsStatuses = payload.search.orderStatus?.length
      ? payload.search.orderStatus.map(coreStatusToWcs).join(',')
      : ALL_HISTORY_STATUSES;

    debug(
      'queryByTerm statuses=%s page=%d/%d',
      wcsStatuses,
      pageNumber,
      pageSize,
    );

    const data = await this.client.callGet<HclWcsOrderListResponse>(
      this.orderByStatusUrl(wcsStatuses),
      this.orderByStatusParams(pageSize, (pageNumber - 1) * pageSize),
    );

    return success(
      this.factory.parseOrderSearchResult(this.context, data, payload),
    );
  }

  protected orderByStatusUrl(statuses: string): string {
    return `${this.client.transactionBaseUrl}/order/byStatus/${encodeURIComponent(statuses)}`;
  }

  protected orderByStatusParams(
    maxResults: number,
    startIndex: number,
  ): URLSearchParams {
    return new URLSearchParams({
      maxResults: String(maxResults),
      startIndex: String(startIndex),
    });
  }
}
