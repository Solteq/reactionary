import { buildClient } from '@reactionary/core';
import { CustomAlgoliaProductProvider } from './providers/custom-algolia-product.provider';


describe('initialize extended providers', () => {
  it('should be able to extend a provider with a custom schema with a default value', async () => {
    const provider = new CustomAlgoliaProductProvider({
      apiKey: process.env['ALGOLIA_API_KEY'] || '',
      appId: process.env['ALGOLIA_APP_ID'] || '',
      indexName: process.env['ALGOLIA_INDEX'] || '',
    });

    const client = buildClient([
      {
        product: provider
      }
    ]);

    const product = await client.product.get({
      id: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
    });

    expect(product.gtin).toBe('missingggg');
    expect(product.name).toBe('SUNNAI GLASS BOWL');
  });
});
