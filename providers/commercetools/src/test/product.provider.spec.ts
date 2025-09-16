import 'dotenv/config';
import { NoOpCache, ProductSchema, Session } from '@reactionary/core';
import { CommercetoolsProductProvider } from '../providers/product.provider';
import { createAnonymousTestSession, getCommercetoolsTestConfiguration } from './test-utils';

describe('Commercetools Product Provider', () => {

    let provider: CommercetoolsProductProvider;
    let session: Session;

    beforeAll( () => {
      provider = new CommercetoolsProductProvider(getCommercetoolsTestConfiguration(), ProductSchema, new NoOpCache());
    });

    beforeEach( () => {
      session = createAnonymousTestSession()
    })


  it('should be able to get a product by id', async () => {
    const result = await provider.getById( { id:  '4d28f98d-c446-446e-b59a-d9f718e5b98a'}, session);

    expect(result.identifier.key).toBe('4d28f98d-c446-446e-b59a-d9f718e5b98a');
    expect(result.name).toBe('Sunnai Glass Bowl');
    expect(result.image).toBe('https://storage.googleapis.com/merchant-center-europe/sample-data/goodstore/Sunnai_Glass_Bowl-1.1.jpeg');
  });
});
