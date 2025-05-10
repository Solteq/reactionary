import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';

describe('initialize mixed providers', () => {
  it('should be able to handle a mixture of providers', async () => {
    const client = buildClient([
      withAlgoliaCapabilities(
        {
          apiKey: process.env['ALGOLIA_API_KEY'] || '',
          appId: process.env['ALGOLIA_APP_ID'] || '',
          indexName: process.env['ALGOLIA_INDEX'] || '',
        },
        { search: true }
      ),
      withCommercetoolsCapabilities(
        {
          apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
          authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
          clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
          clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
          projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || '',
        },
        { product: true }
      ),
    ]);

    const search = await client.search.get({ term: 'glass', page: 0, pageSize: 10, facets: [] });

    expect(search.products.length).toBeGreaterThan(0);

    const product = await client.product.get({ id: search.products[0].identifier.key });

    expect(product.identifier.key).toBe(search.products[0].identifier.key);
  });
});
