import { AlgoliaSearchProvider } from '../providers/search.provider';

describe('Algolia Search Provider', () => {
  const provider = new AlgoliaSearchProvider({
    apiKey: process.env['ALGOLIA_API_KEY'] || '',
    appId: process.env['ALGOLIA_APP_ID'] || '',
    indexName: process.env['ALGOLIA_INDEX'] || '',
  });

  it('should be able to get a result by term', async () => {
    const result = await provider.get({
      term: 'glass',
      page: 0,
      pageSize: 20,
      facets: [],
    });

    expect(result.products.length).toBeGreaterThan(0);
    expect(result.facets.length).toBe(2);
    expect(result.facets[0].values.length).toBeGreaterThan(0);
    expect(result.facets[1].values.length).toBeGreaterThan(0);
  });

  it('should be able to paginate', async () => {
    const firstPage = await provider.get({
      term: 'glass',
      page: 0,
      pageSize: 20,
      facets: [],
    });
    const secondPage = await provider.get({
      term: 'glass',
      page: 1,
      pageSize: 20,
      facets: [],
    });

    expect(firstPage.identifier.page).toBe(0);
    expect(secondPage.identifier.page).toBe(1);
    expect(firstPage.products[0].identifier.id).not.toEqual(
      secondPage.products[0].identifier.id
    );
  });

  it('should be able to change page size', async () => {
    const smallPage = await provider.get({
      term: 'glass',
      page: 0,
      pageSize: 2,
      facets: [],
    });
    const largePage = await provider.get({
      term: 'glass',
      page: 0,
      pageSize: 30,
      facets: [],
    });

    expect(smallPage.products.length).toBe(2);
    expect(smallPage.identifier.pageSize).toBe(2);
    expect(largePage.products.length).toBe(30);
    expect(largePage.identifier.pageSize).toBe(30);
  });

  it('should be able to apply facets', async () => {
    const initial = await provider.get({
      term: 'glass',
      page: 0,
      pageSize: 2,
      facets: [],
    });
    const filtered = await provider.get({
      term: 'glass',
      page: 0,
      pageSize: 2,
      facets: [initial.facets[0].values[0].identifier],
    });

    expect(initial.pages).toBeGreaterThan(filtered.pages);
  });
});
