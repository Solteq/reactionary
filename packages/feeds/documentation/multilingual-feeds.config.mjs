/**
 * Multilingual example config for da, nb, sv, fi, and en.
 *
 * Configure provider environment variables in `.env`, then run:
 *
 *   reactionary-feeds list-feeds --config ./multilingual-feeds.config.mjs
 *   reactionary-feeds generate --config ./multilingual-feeds.config.mjs --feed da --output google-merchant-feed=./google-merchant-da.xml
 *   reactionary-feeds generate --config ./multilingual-feeds.config.mjs --feed fi --output acp-product-feed=./products-fi.jsonl --output sitemap-feed=./products-fi.xml
 */

const languageFeeds = {
  da: {
    locale: 'da-DK',
    currencyCode: 'DKK',
  },
  nb: {
    locale: 'nb-NO',
    currencyCode: 'NOK',
  },
  sv: {
    locale: 'sv-SE',
    currencyCode: 'SEK',
  },
  fi: {
    locale: 'fi-FI',
    currencyCode: 'EUR',
  },
  en: {
    locale: 'en-GB',
    currencyCode: 'GBP',
  },
};

export default {
  defaultFulfillmentCenterKeys: ['OnlineFfmChannel'],
  productConcurrency: 10,
  feeds: Object.fromEntries(
    Object.entries(languageFeeds).map(([language, definition]) => [
      language,
      {
        languageContext: {
          locale: definition.locale,
          currencyCode: definition.currencyCode,
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
        productUrlBase: `https://shop.example/${language}/products/{slug}`,
        sellerName: 'Example Shop',
      },
    ]),
  ),
};
