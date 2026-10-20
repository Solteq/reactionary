import type {
  Cache,
  GenericError,
  InvalidInputError,
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
  error,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoClient } from '../core/client.js';
import {
  MagentoOrderScanLimitError,
  MagentoSearchCriteria,
  escapeMagentoLikeValue,
  fetchMagentoOrderIds,
  fetchMagentoOrderSkus,
  toMagentoDateTime,
} from '../core/order.api.js';
import { magentoOrderStatesFor } from '../factories/order/order-mapping.js';
import type { MagentoOrderSearchFactory } from '../factories/order-search/order-search.factory.js';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoSalesOrderSearchResult } from '../schema/magento.types.js';
import { handleMagentoProviderError } from '../utils/magento-errors.js';

const debug = createDebug('reactionary:magento:order-search');

/**
 * Order search over the admin order list. The admin token sees every order,
 * so every query is pinned to the signed-in customer's `customer_id`, and the
 * answer is checked against it before anything is returned.
 */
export class MagentoOrderSearchCapability<
  TFactory extends OrderSearchFactory = MagentoOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  /**
   * The most orders a part-number search inspects. Beyond it the caller is
   * asked to narrow the search instead of getting a truncated answer.
   */
  protected partNumberScanLimit = 5000;

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

  /**
   * The signed-in customer's id, or null for guests and rejected tokens.
   * Other failures (Magento down, misconfiguration) propagate.
   */
  protected async resolveCustomerId(): Promise<string | null> {
    const customerId = await this.magentoApi.getCustomerId();
    return customerId === null ? null : String(customerId);
  }

  /** Rejects the search options that would widen or that Magento cannot honour. */
  protected validateSearch(
    payload: OrderSearchQueryByTerm,
    customerId: string,
  ): InvalidInputError | undefined {
    const search = payload.search;
    if (search.user?.userId && search.user.userId !== customerId) {
      return {
        type: 'InvalidInput',
        error: 'Orders can only be searched for the signed-in customer.',
      };
    }
    if (search.company) {
      return {
        type: 'InvalidInput',
        error: 'Company-wide order search is not supported by the Magento provider.',
      };
    }
    if (search.filters.length > 0) {
      return {
        type: 'InvalidInput',
        error: 'Additional order search filters are not supported by the Magento provider.',
      };
    }
    if (search.startDate && !toMagentoDateTime(search.startDate, 'start')) {
      return { type: 'InvalidInput', error: `Invalid startDate: ${search.startDate}` };
    }
    if (search.endDate && !toMagentoDateTime(search.endDate, 'end')) {
      return { type: 'InvalidInput', error: `Invalid endDate: ${search.endDate}` };
    }
    return undefined;
  }

  /**
   * The filters of the search (no paging), always starting with the
   * customer scope.
   */
  protected buildSearchCriteria(
    payload: OrderSearchQueryByTerm,
    customerId: string,
  ): MagentoSearchCriteria {
    const search = payload.search;
    const criteria = new MagentoSearchCriteria().where('customer_id', customerId);

    const term = search.term.trim();
    if (term) {
      criteria.where('increment_id', `%${escapeMagentoLikeValue(term)}%`, 'like');
    }

    if (search.orderStatus && search.orderStatus.length > 0) {
      // Keyed on the state, as the factories map it: custom statuses follow.
      criteria.where('state', magentoOrderStatesFor(search.orderStatus).join(','), 'in');
    }

    const startDate = search.startDate && toMagentoDateTime(search.startDate, 'start');
    if (startDate) {
      criteria.where('created_at', startDate, 'gteq');
    }
    const endDate = search.endDate && toMagentoDateTime(search.endDate, 'end');
    if (endDate) {
      criteria.where('created_at', endDate, 'lteq');
    }

    return criteria;
  }

  protected buildSearchParams(
    payload: OrderSearchQueryByTerm,
    customerId: string,
  ): URLSearchParams {
    return this.buildSearchCriteria(payload, customerId)
      .page(payload.search.paginationOptions.pageSize, payload.search.paginationOptions.pageNumber)
      .sort('created_at', 'DESC')
      .toParams();
  }

  /**
   * Part numbers are matched server side: the ids of the customer's orders
   * that pass the other filters are read first, then the sales order items
   * with those skus, and only the requested page of matching orders is
   * loaded, so the total stays exact.
   */
  protected async searchByPartNumber(
    payload: OrderSearchQueryByTerm,
    customerId: string,
    partNumbers: string[],
  ): Promise<MagentoSalesOrderSearchResult> {
    const { pageSize, pageNumber } = payload.search.paginationOptions;
    const skus = Array.from(new Set(partNumbers));

    const orderIds = await fetchMagentoOrderIds(
      this.magentoApi,
      this.buildSearchCriteria(payload, customerId).sort('created_at', 'DESC'),
      this.partNumberScanLimit,
    );
    const skusByOrder =
      orderIds.length > 0
        ? await fetchMagentoOrderSkus(this.magentoApi, orderIds, skus)
        : new Map<number, Set<string>>();
    const matching = orderIds.filter((id) =>
      skus.every((sku) => skusByOrder.get(id)?.has(sku)),
    );

    const pageIds = matching.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
    const page =
      pageIds.length > 0
        ? await this.magentoApi.searchOrders(
            new MagentoSearchCriteria()
              .where('customer_id', customerId)
              .where('entity_id', pageIds.join(','), 'in')
              .page(pageIds.length, 1)
              .sort('created_at', 'DESC')
              .toParams(),
          )
        : undefined;

    return {
      items: page?.items ?? [],
      total_count: matching.length,
      search_criteria: { page_size: pageSize, current_page: pageNumber },
    };
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(
    payload: OrderSearchQueryByTerm,
  ): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    try {
      const customerId = await this.resolveCustomerId();
      if (!customerId) {
        return error<GenericError>({
          type: 'Generic',
          message: 'Order search requires a signed-in customer.',
        });
      }

      const invalid = this.validateSearch(payload, customerId);
      if (invalid) {
        return error<InvalidInputError>(invalid);
      }

      const partNumbers = payload.search.partNumber ?? [];
      const response =
        partNumbers.length > 0
          ? await this.searchByPartNumber(payload, customerId, partNumbers)
          : await this.magentoApi.searchOrders(this.buildSearchParams(payload, customerId));

      // The admin list must never hand out someone else's order.
      if (response.items.some((order) => String(order.customer_id) !== customerId)) {
        debug('queryByTerm: Magento returned orders outside customer %s', customerId);
        return error<GenericError>({
          type: 'Generic',
          message: 'Magento returned orders outside the signed-in customer\'s scope.',
        });
      }

      return success(this.factory.parseOrderSearchResult(this.context, response, payload));
    } catch (err) {
      if (err instanceof MagentoOrderScanLimitError) {
        return error<InvalidInputError>({ type: 'InvalidInput', error: err.message });
      }
      return handleMagentoProviderError('search orders', err, payload.search);
    }
  }

  /**
   * @deprecated Part numbers are now filtered server side (see
   * `searchByPartNumber`); filtering a fetched page leaves the total wrong.
   */
  protected filterByPartNumber(
    response: MagentoSalesOrderSearchResult,
    partNumbers: string[],
  ): MagentoSalesOrderSearchResult {
    const items = response.items.filter((order) => {
      const skus = (order.items ?? []).map((item) => item.sku);
      return partNumbers.every((partNumber) => skus.includes(partNumber));
    });
    return { ...response, items, total_count: items.length };
  }
}
