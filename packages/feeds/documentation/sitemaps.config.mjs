/**
 * Example config for generating product feed outputs and serving sitemap sources.
 *
 * Product-feed CLI outputs:
 *
 *   reactionary-feeds generate --config ./feeds.config.mjs --feed finnish --output sitemap-feed=./products.xml
 *
 * Generic sitemap source routes are exposed by ReactionaryFeedServer:
 *
 *   GET /sitemaps.xml
 *   GET /sitemaps/products-fi.xml
 *   GET /sitemaps/categories-fi.xml
 *   GET /sitemaps/stores-fi.xml
 */

const finnishLanguageContext = {
  locale: 'fi-FI',
  currencyCode: 'EUR',
};

export default {
  defaultFulfillmentCenterKeys: ['default'],
  productConcurrency: 10,
  feeds: {
    finnish: {
      languageContext: finnishLanguageContext,
      search: {
        term: '',
        facets: [],
        filters: ['market:fi'],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 50,
        },
      },
      productUrlBase: 'https://shop.example/{lang}/products/{slug}',
      sellerName: 'Example Shop',
    },
  },

  sitemaps: {
    baseUrl: 'https://shop.example',
    include: ['products-fi', 'categories-fi', 'stores-fi'],
    sources: {
      'products-fi': {
        type: 'products',
        feed: 'finnish',
        changefreq: 'daily',
        priority: 0.8,
      },

      'categories-fi': {
        type: 'categories',
        languageContext: finnishLanguageContext,
        urlTemplate: 'https://shop.example/{lang}/categories/{slug}',
        pageSize: 50,
        maxDepth: 10,
        changefreq: 'weekly',
        priority: 0.7,
      },

      'stores-fi': {
        type: 'stores',
        languageContext: finnishLanguageContext,
        urlTemplate: 'https://shop.example/{lang}/stores/{slug}',
        proximity: {
          longitude: 24.9384,
          latitude: 60.1699,
          distance: 250,
          limit: 100,
        },
        changefreq: 'monthly',
        priority: 0.5,
      },
    },
  },
};
