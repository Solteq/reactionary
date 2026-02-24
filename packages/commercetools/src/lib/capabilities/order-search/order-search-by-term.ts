import {
  OrderSearchQueryByTermSchema,
  OrderSearchResultSchema,
  success,
  type OrderSearchByTermProcedureDefinition,
} from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { parseCommercetoolsOrderSearchResult } from './order-search-mapper.js';

export const commercetoolsOrderSearchByTerm = commercetoolsProcedure({
  inputSchema: OrderSearchQueryByTermSchema,
  outputSchema: OrderSearchResultSchema,
  fetch: async (query, _context, provider) => {
    const root = await provider.client.getClient();
    const client = root
      .withProjectKey({ projectKey: provider.config.projectKey })
      .me()
      .orders();

    const where: string[] = [];
    if (query.search) {
      if (query.search.partNumber) {
        for (const partNumber of query.search.partNumber) {
          where.push(`lineItems(variant(sku="${partNumber}"))`);
        }
      }

      if (query.search.orderStatus) {
        const orderStatusWhere = query.search.orderStatus.map(x => {
          let mappedStatus = 'Open';
          if (x === 'AwaitingPayment') {
            mappedStatus = 'Open';
          }
          if (x === 'ReleasedToFulfillment') {
            mappedStatus = 'Confirmed';
          }
          if (x === 'Shipped') {
            mappedStatus = 'Complete';
          }
          if (x === 'Cancelled') {
            mappedStatus = 'Cancelled';
          }
          return `orderState="${mappedStatus}"`;
        }).join(' OR ');
        where.push(orderStatusWhere);
      }

      if (query.search.startDate) {
        where.push(`createdAt >= "${query.search.startDate}"`);
      }

      if (query.search.endDate) {
        where.push(`createdAt <= "${query.search.endDate}"`);
      }
    }

    const response = await client.get({
      queryArgs: {
        where,
        withTotal: true,
        limit: query.search.paginationOptions.pageSize,
        offset:
          (query.search.paginationOptions.pageNumber - 1) *
          query.search.paginationOptions.pageSize,
      },
    }).execute();

    return success({
      body: response.body,
      query,
    });
  },
  transform: async (_query, context, data) => {
    return success(parseCommercetoolsOrderSearchResult(
      data.body,
      data.query,
      context.request.languageContext.currencyCode,
    ));
  },
}) satisfies OrderSearchByTermProcedureDefinition<CommercetoolsProcedureContext>;
