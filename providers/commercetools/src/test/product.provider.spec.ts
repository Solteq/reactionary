import 'dotenv/config';
import type { RequestContext} from '@reactionary/core';
import { NoOpCache, ProductSchema, Session, createInitialRequestContext } from '@reactionary/core';
import { CommercetoolsProductProvider } from '../providers/product.provider';
import {  getCommercetoolsTestConfiguration } from './test-utils';

const testData = {
  product : {
    id: '4d28f98d-c446-446e-b59a-d9f718e5b98a',
    name: 'Sunnai Glass Bowl',
    image: 'https://storage.googleapis.com/merchant-center-europe/sample-data/goodstore/Sunnai_Glass_Bowl-1.1.jpeg'
  }
}

describe('Commercetools Product Provider', () => {

    let provider: CommercetoolsProductProvider;
    let reqCtx: RequestContext;

    beforeAll( () => {
      provider = new CommercetoolsProductProvider(getCommercetoolsTestConfiguration(), ProductSchema, new NoOpCache());
    });

    beforeEach( () => {
      reqCtx = createInitialRequestContext()
    })


  it('should be able to get a product by id', async () => {
    const result = await provider.getById( { id: testData.product.id }, reqCtx);

    expect(result).toBeTruthy();
    expect(result.identifier.key).toBe(testData.product.id);
    expect(result.meta.placeholder).toBe(false);
    expect(result.name).toBe(testData.product.name);
    expect(result.image).toBe(testData.product.image);
  });

  it('should be able to get a product by slug', async () => {
    const result = await provider.getBySlug( { slug: 'sunnai-glass-bowl' }, reqCtx);

    expect(result).toBeTruthy();
    if (result) {
      expect(result.meta.placeholder).toBe(false);
      expect(result.identifier.key).toBe(testData.product.id);
      expect(result.name).toBe(testData.product.name);
      expect(result.image).toBe(testData.product.image);
    }
  });

  it('should return null for unknown slug', async () => {
    const result = await provider.getBySlug( { slug: 'unknown-slug' }, reqCtx);

    expect(result).toBeNull();
  });

  it('should return a placeholder product for unknown id', async () => {
    const result = await provider.getById( { id: 'unknown-id' }, reqCtx);

    expect(result).toBeTruthy();
    expect(result.meta.placeholder).toBe(true);
  });
});
