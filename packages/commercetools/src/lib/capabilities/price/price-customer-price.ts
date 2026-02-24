import { CustomerPriceQuerySchema, PriceSchema, success, type PriceCustomerPriceProcedureDefinition } from '@reactionary/core';
import { commercetoolsProcedure, type CommercetoolsProcedureContext } from '../../core/context.js';
import { parseCommercetoolsPrice } from './price-mapper.js';

export const commercetoolsPriceCustomerPrice = commercetoolsProcedure({
  inputSchema: CustomerPriceQuerySchema,
  outputSchema: PriceSchema,
  fetch: async (query, context, provider) => {
    const root = await provider.client.getClient();
    const client = root.withProjectKey({ projectKey: provider.config.projectKey });
    const priceChannelId = 'ee6e75e9-c9ab-4e2f-85f1-d8c734d0cb86';

    const response = await client
      .productProjections()
      .get({
        queryArgs: {
          staged: false,
          priceCountry: context.request.taxJurisdiction.countryCode,
          priceCustomerGroup: undefined,
          priceChannel: priceChannelId,
          priceCurrency: context.request.languageContext.currencyCode,
          where: 'variants(sku in (:skus)) OR (masterVariant(sku in (:skus))) ',
          'var.skus': [query.variant.sku],
          limit: 1,
        },
      })
      .execute();

    return success(response.body.results[0]);
  },
  transform: async (query, context, data) => {
    const sku = [data.masterVariant, ...data.variants].find(
      (x) => x.sku === query.variant.sku
    );
    return success(parseCommercetoolsPrice(sku!, context.request.languageContext.currencyCode, { includeDiscounts: true }));
  },
}) satisfies PriceCustomerPriceProcedureDefinition<CommercetoolsProcedureContext>;
