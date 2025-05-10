import { buildClient } from '@reactionary/core';
import { withCommercetoolsCapabilities } from '@reactionary/provider-commercetools';

describe('initialize commercetools', () => {
  it('should be able to search against commercetools', async () => {
    const client = buildClient([
      withCommercetoolsCapabilities(
        {
          apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
          authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
          clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
          clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
          projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || '',
        },
        { product: true, search: true }
      ),
    ]);

    expect(client.search).toBeDefined();

    const result = await client.search.get({
      term: 'glass',
      page: 0,
      pageSize: 10,
      facets: []
    });

    expect(result.identifier.term).toBe('glass');
    expect(result.products.length).toBeGreaterThan(0);
  });
});
