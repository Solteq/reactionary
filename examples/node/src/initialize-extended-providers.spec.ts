import { buildClient, ProductSchema } from '@reactionary/core';
import {
  AlgoliaProductProvider,
} from '@reactionary/provider-algolia';
import { z } from 'zod';

describe('initialize extended providers', () => {
  it('should be able to extend a provider with a custom schema with a default value', async () => {
    const ExtendedProductSchema = ProductSchema.extend({
      extendedProductField: z.string().default('default value'),
    });

    class ExtendedAlgoliaProductProvider extends AlgoliaProductProvider {
      protected override schema() {
        return ExtendedProductSchema;
      }
    }

    const client = buildClient([
      {
        product: new ExtendedAlgoliaProductProvider({
          apiKey: process.env['ALGOLIA_API_KEY'] || '',
          appId: process.env['ALGOLIA_APP_ID'] || '',
          indexName: process.env['ALGOLIA_INDEX'] || '',
        }),
      },
    ]);

    const product = await client.product.get({
      id: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
    });

    expect((product as any).extendedProductField).toBe('default value');
  });
});
