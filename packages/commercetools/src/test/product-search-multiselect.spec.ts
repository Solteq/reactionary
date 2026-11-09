import { describe, expect, it } from 'vitest';
import {
  NoOpCache,
  ProductSearchQueryByTermSchema,
  ProductSearchResultSchema,
  createInitialRequestContext,
} from '@reactionary/core';
import type { ProductSearchQueryByTerm } from '@reactionary/core';
import { CommercetoolsProductSearchCapability } from '../capabilities/product-search.capability.js';
import { CommercetoolsProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { CommercetoolsConfigurationSchema } from '../schema/configuration.schema.js';
import { CommercetoolsAPI } from '../core/client.js';

class TestableCapability extends CommercetoolsProductSearchCapability {
  public facetsQuery(payload: ProductSearchQueryByTerm) {
    return this.getFacetsQuery(payload);
  }
}

const query = (search: Record<string, unknown>): ProductSearchQueryByTerm =>
  ProductSearchQueryByTermSchema.parse({
    search: { term: 'drill', facets: [], filters: [], paginationOptions: { pageNumber: 1, pageSize: 10 }, ...search },
  });

const language = createInitialRequestContext().languageContext.locale.split('-')[0];
const exact = (field: string, value: string) => ({ exact: { field, fieldType: 'ltext', language, value } });

const config = CommercetoolsConfigurationSchema.parse({
  projectKey: 'p',
  authUrl: 'https://auth.invalid',
  apiUrl: 'https://api.invalid',
  clientId: 'id',
  clientSecret: 'secret',
});

// Only the facet filter is built: the client is never asked for a token
const capability = (facets?: { multiselect: string[] }) => {
  const context = createInitialRequestContext();
  return new TestableCapability(
    { ...config, facets },
    new NoOpCache(),
    context,
    new CommercetoolsAPI(config, context),
    new CommercetoolsProductSearchFactory(ProductSearchResultSchema),
  );
};

const bucket = (key: string) => ({ facet: { key: 'reviewBucket' }, key });
const brand = (key: string) => ({ facet: { key: 'manufacturer' }, key });

describe('commercetools multiselect facets', () => {
  it('ANDs every selected value, as before, without a multiselect policy', async () => {
    expect(await capability().facetsQuery(query({ facets: [bucket('4'), bucket('5')] }))).toEqual({
      and: [exact('reviewBucket', '4'), exact('reviewBucket', '5')],
    });
  });

  it('ORs the values of a multiselect facet and ANDs the rest', async () => {
    const facets = [bucket('4'), brand('Bosch'), bucket('5')];

    expect(await capability({ multiselect: ['reviewBucket'] }).facetsQuery(query({ facets }))).toEqual({
      and: [exact('manufacturer', 'Bosch'), { or: [exact('reviewBucket', '4'), exact('reviewBucket', '5')] }],
    });
  });

  it('does not wrap a single selected value of a multiselect facet', async () => {
    expect(await capability({ multiselect: ['reviewBucket'] }).facetsQuery(query({ facets: [bucket('4')] }))).toEqual(
      exact('reviewBucket', '4'),
    );
  });
});
