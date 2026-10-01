/**
 * Minimal example config for the `reactionary-feeds` CLI.
 *
 * Copy this file, configure provider environment variables in `.env`, and run:
 *
 *   reactionary-feeds list-feeds --config ./feeds.config.mjs
 *   reactionary-feeds generate --config ./feeds.config.mjs --feed default --output google-merchant-feed=./google-merchant.xml
 */

export default {
  defaultFulfillmentCenterKeys: ['default'],
  productConcurrency: 10,
  feeds: {
    default: {
      languageContext: {
        locale: 'en-GB',
        currencyCode: 'EUR',
      },
      search: {
        term: '',
        facets: [],
        filters: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 50,
        },
      },
      productUrlBase: 'https://shop.example/{lang}/products/{slug}',
      sellerName: 'Example Shop',
    },
  },
};
