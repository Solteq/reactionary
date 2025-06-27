import { buildClient, Session } from '@reactionary/core';
import { CustomAlgoliaProductProvider } from './providers/custom-algolia-product.provider';


describe('initialize extended providers', () => {
  it('should be able to extend a provider with a custom schema with a default value', async () => {
    const session: Session = {
      id: '1234',
      identity: {
        id: '1234',
        issued: new Date(),
        expiry: new Date(),
        token: '',
        type: 'Anonymous'
      }
    }

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

    const product = await client.product.query([{
      id: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
      query: 'id'
    }], session);

    expect(product[0].gtin).toBe('missingggg');
    expect(product[0].name).toBe('SUNNAI GLASS BOWL');
  });
});
