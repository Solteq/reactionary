import { buildClient } from '@reactionary/core';
import { withAlgoliaCapabilities } from '@reactionary/provider-algolia';

describe('initialize algolia', () => {
  it('should be able to search against algolia', async () => {
    const client = buildClient([
      withAlgoliaCapabilities(
        {
          apiKey: process.env['ALGOLIA_API_KEY'] || '',
          appId: process.env['ALGOLIA_APP_ID'] || '',
          indexName: process.env['ALGOLIA_INDEX'] || '',
        },
        { products: true, search: true }
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
