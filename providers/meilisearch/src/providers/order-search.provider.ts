import {
  type Cache,
  type OrderSearchQueryByTerm,
  OrderSearchQueryByTermSchema,
  type OrderSearchResult,
  type OrderSearchResultItem,
  OrderSearchResultSchema,
  OrderSearchProvider,
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
} from '@reactionary/core';
import { MeiliSearch, type SearchParams, type SearchResponse } from 'meilisearch';
import type { MeilisearchConfiguration } from '../schema/configuration.schema.js';

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

export class MeilisearchOrderSearchProvider extends OrderSearchProvider {
  protected config: MeilisearchConfiguration;

  constructor(config: MeilisearchConfiguration, cache: Cache, context: RequestContext) {
    super(cache, context);
    this.config = config;
  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(payload: OrderSearchQueryByTerm): Promise<Result<OrderSearchResult>> {
    const client = new MeiliSearch({
      host: this.config.apiUrl,
      apiKey: this.config.apiKey,
    });

    const index = client.index(this.config.orderIndexName);

    const filters: string[] = [];

    // Add status filter
    if (payload.search.orderStatus && payload.search.orderStatus.length > 0) {
      const statusFilters = payload.search.orderStatus
        .map((status) => `orderStatus = "${this.mapOrderStatus(status)}"`)
        .join(' OR ');
      filters.push(`(${statusFilters})`);
    }

    // Add user ID filter for B2B use cases with hierarchical order access
    if (payload.search.user) {
      filters.push(`userIdentifier = "${payload.search.user.userId}"`);
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
        .map((partNumber) => `items.sku = "${partNumber}"`)
        .join(' OR ');
      filters.push(`(${partNumberFilters})`);
    }

    const searchOptions: SearchParams = {
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,
      limit: payload.search.paginationOptions.pageSize,
      filter: filters.length > 0 ? filters.join(' AND ') : undefined,
      sort: ['orderDateTimestamp:desc'],
    };

    const remote = await index.search<MeilisearchNativeOrderRecord>(
      payload.search.term || '',
      searchOptions
    );

    const result = this.parsePaginatedResult(remote, payload) as OrderSearchResult;

    return success(result);
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
