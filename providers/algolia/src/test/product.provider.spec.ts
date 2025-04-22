import { AlgoliaProductProvider } from '../providers/product.provider';

describe('Algolia Product Provider', () => {
  it('should be able to get a product by id', async () => {
    const provider = new AlgoliaProductProvider({
        apiKey: process.env['ALGOLIA_API_KEY'] || '',
        appId: process.env['ALGOLIA_APP_ID'] || '',
        indexName: process.env['ALGOLIA_INDEX'] || ''
    });

    const result = await provider.get({ id: '4d28f98d-c446-446e-b59a-d9f718e5b98a'});

    expect(result.identifier.id).toBe('4d28f98d-c446-446e-b59a-d9f718e5b98a');
    expect(result.name).toBe('Sunnai Glass Bowl');
    expect(result.image).toBe('https://res.cloudinary.com/dfke2ip5c/image/upload/c_thumb,w_200,g_face/v1744117881/6d189e9017e385a6a465b9099227ccae.jpeg');
  });
});
