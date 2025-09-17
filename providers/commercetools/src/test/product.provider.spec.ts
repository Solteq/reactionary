import 'dotenv/config';
import { NoOpCache, ProductSchema, Session } from '@reactionary/core';
import { CommercetoolsProductProvider } from '../providers/product.provider';
import { createAnonymousTestSession, getCommercetoolsTestConfiguration } from './test-utils';

const testData = {
  product : {
    id: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
    name: 'Sunnai Glass Bowl',
    image: 'https://storage.googleapis.com/merchant-center-europe/sample-data/goodstore/Sunnai_Glass_Bowl-1.1.jpeg'
  }
}

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
    const result = await provider.getById( { id: testData.product.id }, session);

    expect(result.identifier.key).toBe(testData.product.id);
    expect(result.name).toBe(testData.product.name);
    expect(result.image).toBe(testData.product.image);
  });
});
