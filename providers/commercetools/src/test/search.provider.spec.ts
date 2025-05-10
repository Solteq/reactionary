import { SearchResultSchema } from '@reactionary/core';
import { CommercetoolsSearchProvider } from '../providers/search.provider';

describe('Commercetools Search Provider', () => {
  it('should be able to get a result by term', async () => {
    const provider = new CommercetoolsSearchProvider({
      apiUrl: process.env['COMMERCETOOLS_API_URL'] || '',
      authUrl: process.env['COMMERCETOOLS_AUTH_URL'] || '',
      clientId: process.env['COMMERCETOOLS_CLIENT_ID'] || '',
      clientSecret: process.env['COMMERCETOOLS_CLIENT_SECRET'] || '',
      projectKey: process.env['COMMERCETOOLS_PROJECT_KEY'] || '',
    }, SearchResultSchema);

    const result = await provider.get({ term: 'glass', page: 0, pageSize: 20, facets: [] });

    expect(result.products.length).toBeGreaterThan(0);
  });
});
