import type {
  RequestContext,
  Cache,
  OrderSearchQueryByTerm,
  OrderSearchResult,
  Result,
  OrderSearchIdentifier,
  MonetaryAmount,
  Currency,
  IdentityIdentifier,
  Address,
  OrderStatus,
} from '@reactionary/core';
import {
  OrderSearchProvider,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  type OrderSearchResultItem,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { CommercetoolsAPI } from '../core/client.js';
import createDebug from 'debug';
import type { Order as CTOrder, OrderPagedSearchResponse , Address as CTAddress, OrderPagedQueryResponse} from '@commercetools/platform-sdk';

const debug = createDebug('reactionary:commercetools:order-search');

export class CommercetoolsOrderSearchProvider extends OrderSearchProvider {
  protected config: CommercetoolsConfiguration;
  protected commercetools: CommercetoolsAPI;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    commercetools: CommercetoolsAPI
  ) {
    super(cache, context);

    this.config = config;
    this.commercetools = commercetools;
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
  public async queryByTerm(payload: OrderSearchQueryByTerm): Promise<Result<OrderSearchResult>> {
    debug('queryByTerm', payload);

    const client = await this.getClient();
    const where: string[] = [];
    if (payload.search) {
      if (payload.search.term) {
        debug('Search by term is not implemented yet in CommercetoolsOrderSearchProvider');
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
    const result = this.parsePaginatedResult(
      responseBody,
      payload
    ) as OrderSearchResult;

    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${responseBody.results.length} orders (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }

  protected parseAddress(remote: CTAddress) {
    return {
      countryCode: remote.country || '',
      firstName: remote.firstName || '',
      lastName: remote.lastName || '',
      streetAddress: remote.streetName || '',
      streetNumber: remote.streetNumber || '',
      postalCode: remote.postalCode || '',
      city: remote.city || '',
      identifier: {
        nickName: '',
      },
      region: '',
    } satisfies Address;
  }


  protected parseSingle(body: CTOrder) {
    const identifier = { key: body.id };
    const userId: IdentityIdentifier = {
      userId: body.customerId || body.anonymousId || '',
    };
    const customerName = `${body.billingAddress?.firstName} ${body.billingAddress?.lastName}`;
    const shippingAddress = this.parseAddress(body.shippingAddress!);
    const orderDate = body.createdAt;
   let orderStatus: OrderStatus = 'AwaitingPayment';
    if (body.paymentState === 'Pending' && body.orderState === 'Open') {
      orderStatus = 'AwaitingPayment';
    } else if (
      body.paymentState === 'Paid' &&
      body.orderState === 'Confirmed'
    ) {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (body.shipmentState === 'Ready' && body.orderState === 'Confirmed') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (
      (body.shipmentState === 'Shipped' ||
        body.shipmentState === 'Delivered') &&
      body.orderState === 'Completed'
    ) {
      orderStatus = 'Shipped';
    }
    let inventoryStatus: OrderSearchResultItem['inventoryStatus'];

    if (orderStatus === 'Shipped') {
      inventoryStatus = 'Allocated'
    } else {
      inventoryStatus = 'NotAllocated'
    }

    const totalAmount: MonetaryAmount = {
      currency: body.totalPrice ? body.totalPrice.currencyCode as Currency : this.context.languageContext.currencyCode,
      value: body.totalPrice ? body.totalPrice.centAmount / 100 : 0
    };

    const order = {
      identifier,
      userId,
      customerName,
      shippingAddress,
      orderDate,
      orderStatus,
      inventoryStatus,
      totalAmount
    } satisfies OrderSearchResultItem;

    return order;
  }

  protected parsePaginatedResult(
    body: OrderPagedQueryResponse,
    query: OrderSearchQueryByTerm
  ) {
    const identifier = {
      ...query.search,
    } satisfies OrderSearchIdentifier;

    const orders: OrderSearchResultItem[] = body.results.map((o) => {
      return this.parseSingle(o);
    })

    const result = {
      identifier,
      pageNumber: (Math.ceil(body.offset / body.limit) || 0) + 1,
      pageSize: body.limit,
      totalCount: body.total || 0,
      totalPages: Math.ceil((body.total || 0) / body.limit || 0) + 1,
      items: orders,
    } satisfies OrderSearchResult;

    return result;
  }


}
