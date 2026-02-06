import type {
  RequestContext,
  Cache,
  OrderSearchQueryByTerm,
  OrderSearchResult,
  Result,
  OrderStatus,
  Address,
  IdentityIdentifier,
  MonetaryAmount,
  Currency,
  OrderSearchResultItem,
  OrderSearchIdentifier,
  AddressIdentifier,
  OrderInventoryStatus,
} from '@reactionary/core';
import {
  AddressIdentifierSchema,
  OrderSearchProvider,
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaAPI } from '../core/client.js';
import createDebug from 'debug';
import type { OrderStatus as MedusaOrderStatus, StoreOrder, StoreOrderAddress,  StoreOrderListResponse } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:order-search');

export class MedusaOrderSearchProvider extends OrderSearchProvider {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public medusaApi: MedusaAPI
  ) {
    super(cache, context);

    this.config = config;

  }

  @Reactionary({
    inputSchema: OrderSearchQueryByTermSchema,
    outputSchema: OrderSearchResultSchema,
  })
  public async queryByTerm(payload: OrderSearchQueryByTerm): Promise<Result<OrderSearchResult>> {
    debug('queryByTerm', payload);

    const medusa = await this.medusaApi.getClient();

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


    const response = await medusa.store.order.list({
      status: statusFilter,
      limit: payload.search.paginationOptions.pageSize,
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,

    });

    const result = this.parsePaginatedResult(response, payload) as OrderSearchResult;
    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.orders.length} orders (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }

  protected composeAddressFromStoreAddress(storeAddress: StoreOrderAddress): Address {
    return {
      identifier: AddressIdentifierSchema.parse({
        nickName: storeAddress.id,
      } satisfies AddressIdentifier),
      firstName: storeAddress.first_name || '',
      lastName: storeAddress.last_name || '',
      streetAddress: storeAddress.address_1 || '',
      streetNumber: storeAddress.address_2 || '',
      city: storeAddress.city || '',
      postalCode: storeAddress.postal_code || '',
      countryCode: storeAddress.country_code || '',
      region: '',
    };
  }



  protected parseSingle(body: StoreOrder) {
    const identifier = { key: body.id };
    const userId: IdentityIdentifier = {
      userId: body.customer_id || '',
    };
    const customerName = `${body.billing_address?.first_name} ${body.billing_address?.last_name}`;
    const shippingAddress = this.composeAddressFromStoreAddress(body.shipping_address!);
    const orderDate = new Date(body.created_at).toISOString();

    let orderStatus: OrderStatus = 'AwaitingPayment'
    if (body.status === 'draft') {
      orderStatus = 'AwaitingPayment';
    }
    if (body.status === 'pending') {
      orderStatus = 'ReleasedToFulfillment';
    }
    if (body.status === 'completed') {
      orderStatus = 'Shipped';
    }
    if (body.status === 'canceled') {
      orderStatus = 'Cancelled';
    }
    let inventoryStatus: OrderInventoryStatus = 'NotAllocated'
    // Medusa does not have direct mapping for inventory status on orders
    // This is a placeholder logic and may need to be adjusted based on actual requirements
    if(body.fulfillment_status === "fulfilled") {
      inventoryStatus = 'Allocated';
    }

    const totalAmount: MonetaryAmount = {
      currency: body.currency_code.toUpperCase() as Currency,
      value: body.total ? body.total : 0
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
    body: StoreOrderListResponse,
    query: OrderSearchQueryByTerm
  ) {
    const identifier = {
      ...query.search,
    } satisfies OrderSearchIdentifier;

    const orders: OrderSearchResultItem[] = body.orders.map((o) => {
      return this.parseSingle(o);
    })

    const result = {
      identifier,
      pageNumber: (Math.ceil(body.offset / body.limit) || 0) + 1,
      pageSize: body.limit,
      totalCount: body.count,
      totalPages: Math.ceil(body.count / body.limit || 0) + 1,
      items: orders,
    } satisfies OrderSearchResult;

    return result;
  }


}
