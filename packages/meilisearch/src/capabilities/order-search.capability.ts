import {
  type Cache,
  type OrderSearchQueryByTerm,
  OrderSearchQueryByTermSchema,
  type OrderSearchResult,
  type OrderSearchResultItem,
  OrderSearchResultSchema,
  OrderSearchCapability,
  Reactionary,
  type RequestContext,
  type Result,
  success,
  type OrderStatus,
  type Address,
  type IdentityIdentifier,
  type MonetaryAmount,
  type Currency,
  type OrderSearchIdentifier,
  AddressIdentifierSchema,
  type AddressIdentifier,
  type OrderInventoryStatus,
  type OrderSearchFactory,
  type OrderSearchFactoryOutput,
  type OrderSearchFactoryWithOutput,
} from '@reactionary/core';
import { Meilisearch, type SearchParams, type SearchResponse } from 'meilisearch';
import type { MeilisearchConfiguration } from '../schema/configuration.schema.js';
import type { MeilisearchOrderSearchFactory } from '../factories/order-search/order-search.factory.js';

interface MeilisearchNativeOrderAddress {
  address1: string;
  address2: string;
  city: string;
  postalCode: string;
  country: string;
}

interface MeilisearchNativeOrderRecord {
  orderIdentifier: string;
  userIdentifier: string;
  customerName: string;
  shippingAddress: MeilisearchNativeOrderAddress;
  orderDate: string;
  orderDateTimestamp: number;
  orderStatus: string;
  inventoryStatus: string;
  totalAmount: number;
  currency: string;
}

export class MeilisearchOrderSearchCapability<
  TFactory extends OrderSearchFactory = MeilisearchOrderSearchFactory,
> extends OrderSearchCapability<OrderSearchFactoryOutput<TFactory>> {
  protected config: MeilisearchConfiguration;
  protected factory: OrderSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MeilisearchConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: OrderSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  /**
   * Escapes a value for use between double quotes in a Meilisearch filter expression. A backslash escapes the
   * following character inside a quoted string, so both the backslash and the double quote must be escaped, or the
   * value can close the string and append filter clauses of its own.
   */
  protected escapeFilterValue(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /**
   * The users whose orders the search is restricted to, or undefined when the current session may not search the
   * requested orders at all.
   *
   * By default a search is scoped to the signed-in user. A search naming another user, or made without being signed in,
   * is not permitted: the order index holds every user's orders, so the caller's own claim about whose orders to list
   * cannot be trusted. `search.company` is not honoured either, as the order index has no company to filter on.
   *
   * Override to let a session search more widely, for example a B2B buyer who may see the orders of their company, and
   * do the authorisation check there.
   */
  protected async resolveScopedUserIds(payload: OrderSearchQueryByTerm): Promise<string[] | undefined> {
    const identity = this.context.session.identityContext.identity;
    if (identity.type !== 'Registered' || identity.id.userId === '') {
      return undefined;
    }

    const requestedUserId = payload.search.user?.userId;
    if (requestedUserId !== undefined && requestedUserId !== identity.id.userId) {
      return undefined;
    }

    return [identity.id.userId];
  }

  /**
   * Whether a caller supplied filter expression stays within its own parentheses. A filter that closes more
   * parentheses than it opens, or leaves a quote open, could end the group it is wrapped in and add an OR of its own
   * next to the user restriction.
   */
  protected isContainedFilterExpression(filter: string): boolean {
    const structure = filter.replace(/"(?:[^"\\]|\\.)*"/g, '');
    if (structure.includes('"')) {
      return false;
    }

    let depth = 0;
    for (const character of structure) {
      if (character === '(') {
        depth += 1;
      } else if (character === ')') {
        depth -= 1;
        if (depth < 0) {
          return false;
        }
      }
    }
    return depth === 0;
  }

  protected emptyResult(payload: OrderSearchQueryByTerm): OrderSearchResult {
    return {
      identifier: { ...payload.search } satisfies OrderSearchIdentifier,
      pageNumber: payload.search.paginationOptions.pageNumber,
      pageSize: payload.search.paginationOptions.pageSize,
      totalCount: 0,
      totalPages: 0,
      items: [],
    } satisfies OrderSearchResult;
  }

  /**
   * @param scopedUserIds The users whose orders may be searched, as resolved by resolveScopedUserIds().
   */
  protected queryByTermPayload(payload: OrderSearchQueryByTerm, scopedUserIds: string[]): SearchParams {

    const filters: string[] = [];

    // Always restrict to the users the session is allowed to see. When there are none, or a supplied filter is not
    // contained, the filter matches nothing, so that a caller of this method cannot end up with an unscoped search.
    const suppliedFilters = payload.search.filters ?? [];
    const isPermitted =
      scopedUserIds.length > 0 && suppliedFilters.every((filter) => this.isContainedFilterExpression(filter));
    if (isPermitted) {
      const userFilters = scopedUserIds
        .map((userId) => `userIdentifier = "${this.escapeFilterValue(userId)}"`)
        .join(' OR ');
      filters.push(scopedUserIds.length > 1 ? `(${userFilters})` : userFilters);
    } else {
      filters.push('(userIdentifier = "" AND userIdentifier != "")');
    }

    // Add status filter
    if (payload.search.orderStatus && payload.search.orderStatus.length > 0) {
      const statusFilters = payload.search.orderStatus
        .map((status) => `orderStatus = "${this.escapeFilterValue(this.mapOrderStatus(status))}"`)
        .join(' OR ');
      filters.push(`(${statusFilters})`);
    }

    // Add date range filters
    if (payload.search.startDate) {
      filters.push(`orderDateTimestamp >= ${new Date(payload.search.startDate).getTime()}`);
    }
    if (payload.search.endDate) {
      filters.push(`orderDateTimestamp <= ${new Date(payload.search.endDate).getTime()}`);
    }


    if (payload.search.partNumber && payload.search.partNumber.length > 0) {
      const partNumberFilters = payload.search.partNumber
        .map((partNumber) => `items.sku = "${this.escapeFilterValue(partNumber)}"`)
        .join(' OR ');
      filters.push(`(${partNumberFilters})`);
    }

    // Each filter is a complete expression, parenthesised so that an OR in one cannot take over the AND that joins it to
    // the user restriction.
    if (isPermitted) {
      for (const filter of suppliedFilters) {
        filters.push(`(${filter})`);
      }
    }

    const searchOptions: SearchParams = {
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,
      limit: payload.search.paginationOptions.pageSize,
      filter: filters.length > 0 ? filters.join(' AND ') : undefined,
      sort: ['orderDateTimestamp:desc'],
    };
    return searchOptions
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(
    payload: OrderSearchQueryByTerm,
  ): Promise<Result<OrderSearchFactoryOutput<TFactory>>> {
    const scopedUserIds = await this.resolveScopedUserIds(payload);
    const filtersAreContained = (payload.search.filters ?? []).every((filter) =>
      this.isContainedFilterExpression(filter),
    );
    if (!scopedUserIds || scopedUserIds.length === 0 || !filtersAreContained) {
      return success(
        this.factory.parseOrderSearchResult(this.context, this.emptyResult(payload), payload),
      );
    }

    const client = new Meilisearch({
      host: this.config.apiUrl,
      apiKey: this.config.apiKey,
    });

    const index = client.index(this.config.orderIndexName);


    const remote = await index.search<MeilisearchNativeOrderRecord>(
      payload.search.term || '',
      this.queryByTermPayload(payload, scopedUserIds)
    );

    const result = this.parsePaginatedResult(remote, payload);

    return success(this.factory.parseOrderSearchResult(this.context, result, payload));
  }

  protected mapOrderStatus(status: OrderStatus): string {
    // Map from Reactionary OrderStatus to Meilisearch native status
    const statusMap: Record<OrderStatus, string> = {
      AwaitingPayment: 'awaiting_payment',
      ReleasedToFulfillment: 'released_to_fulfillment',
      Shipped: 'shipped',
      Cancelled: 'cancelled',
    };
    return statusMap[status] || status;
  }

  protected mapFromNativeOrderStatus(nativeStatus: string): OrderStatus {
    // Map from Meilisearch native status to Reactionary OrderStatus
    const statusMap: Record<string, OrderStatus> = {
      awaiting_payment: 'AwaitingPayment',
      released_to_fulfillment: 'ReleasedToFulfillment',
      shipped: 'Shipped',
      cancelled: 'Cancelled',
    };
    return statusMap[nativeStatus] || 'AwaitingPayment';
  }

  protected mapFromNativeInventoryStatus(nativeStatus: string): OrderInventoryStatus {
    // Map from Meilisearch native status to Reactionary OrderInventoryStatus
    const statusMap: Record<string, OrderInventoryStatus> = {
      not_allocated: 'NotAllocated',
      allocated: 'Allocated',
      preordered: 'Preordered',
      backordered: 'Backordered',
    };
    return statusMap[nativeStatus] || 'NotAllocated';
  }

  protected composeAddressFromNativeAddress(
    nativeAddress: MeilisearchNativeOrderAddress
  ): Address {
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: 'shipping',
      } satisfies AddressIdentifier),
      firstName: '',
      lastName: '',
      streetAddress: nativeAddress.address1,
      streetNumber: nativeAddress.address2,
      city: nativeAddress.city,
      postalCode: nativeAddress.postalCode,
      countryCode: nativeAddress.country,
      region: '',
    };
  }

  protected parseSingle(body: MeilisearchNativeOrderRecord): OrderSearchResultItem {
    const identifier = { key: body.orderIdentifier };
    const userId: IdentityIdentifier = {
      userId: body.userIdentifier,
    };
    const customerName = body.customerName;
    const shippingAddress = this.composeAddressFromNativeAddress(body.shippingAddress);
    const orderDate = body.orderDate;
    const orderStatus = this.mapFromNativeOrderStatus(body.orderStatus);
    const inventoryStatus = this.mapFromNativeInventoryStatus(body.inventoryStatus);

    const totalAmount: MonetaryAmount = {
      currency: (body.currency || this.context.languageContext.currencyCode)  as Currency,
      value: body.totalAmount,
    };

    const order = {
      identifier,
      userId,
      customerName,
      shippingAddress,
      orderDate,
      orderStatus,
      inventoryStatus,
      totalAmount,
    } satisfies OrderSearchResultItem;

    return order;
  }

  protected parsePaginatedResult(
    body: SearchResponse<MeilisearchNativeOrderRecord>,
    query: OrderSearchQueryByTerm
  ): OrderSearchResult {
    const identifier = {
      ...query.search,
    } satisfies OrderSearchIdentifier;

    const orders: OrderSearchResultItem[] = body.hits.map((hit) => {
      return this.parseSingle(hit);
    });

    const totalCount = body.estimatedTotalHits || body.hits.length;
    const totalPages = Math.ceil(totalCount / (body.limit || 1));

    const result = {
      identifier,
      pageNumber: Math.floor((body.offset || 0) / (body.limit || 1)  ) + 1,
      pageSize: body.limit || orders.length,
      totalCount,
      totalPages,
      items: orders,
    } satisfies OrderSearchResult;

    return result;
  }
}
