import { AlgoliaSearchProvider } from '../providers/search.provider';

describe('Algolia Search Provider', () => {
  it('should be able to get a result by term', async () => {
    const provider = new AlgoliaSearchProvider({
        apiKey: process.env['ALGOLIA_API_KEY'] || '',
        appId: process.env['ALGOLIA_APP_ID'] || '',
        indexName: process.env['ALGOLIA_INDEX'] || ''
    });

    const result = await provider.get({ term: 'glass', page: 0, pageSize: 20, facets: [] });

    expect(result.products.length).toBeGreaterThan(0);
  });
});
