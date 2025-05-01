import { buildClient } from '@reactionary/core';
import { CustomAlgoliaProductProvider } from './providers/custom-algolia-product.provider';
import { CustomProductSchema } from './schemas/custom-product.schema';


describe('initialize extended providers', () => {
  it('should be able to extend a provider with a custom schema with a default value', async () => {
    // TODO: for developer experience, having to pass in the schema here (rather than it being in the provider)
    // adds nothing of value
    const provider = new CustomAlgoliaProductProvider({
      apiKey: process.env['ALGOLIA_API_KEY'] || '',
      appId: process.env['ALGOLIA_APP_ID'] || '',
      indexName: process.env['ALGOLIA_INDEX'] || '',
    }, CustomProductSchema);

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
