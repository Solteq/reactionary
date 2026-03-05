import {
  ClientBuilder,
  NoOpCache,
  createInitialRequestContext,
  type ProductSearchQueryByTerm,
  type RequestContext,
} from '@reactionary/core';
import * as z from 'zod';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { withAlgoliaCapabilities } from '../core/initialize.js';
import { AlgoliaProductSearchFactory } from '../factories/product-search/product-search.factory.js';
import { AlgoliaProductSearchResultSchema } from '../schema/search.schema.js';

const assertType = <T>(_value: T) => {
  void _value;
};
type IsAny<T> = 0 extends (1 & T) ? true : false;
const assertNotAny = <T>(_value: IsAny<T> extends true ? never : T) => {
  void _value;
};

const ExtendedProductSearchResultSchema = AlgoliaProductSearchResultSchema.safeExtend(
  {
    extendedMeta: z.string(),
  },
);

class ExtendedAlgoliaProductSearchFactory extends AlgoliaProductSearchFactory<
  typeof ExtendedProductSearchResultSchema
> {
  constructor() {
    super(ExtendedProductSearchResultSchema);
  }

  public override parseSearchResult(
    context: RequestContext,
    data: unknown,
    query: ProductSearchQueryByTerm,
  ) {
    const base = super.parseSearchResult(context, data, query);
    return this.productSearchResultSchema.parse({
      ...base,
      extendedMeta: 'from-factory',
    });
  }
}

const config = {
  appId: 'ALGOLIA_APP_ID',
  apiKey: 'ALGOLIA_API_KEY',
  indexName: 'ALGOLIA_INDEX',
} satisfies AlgoliaConfiguration;

const client = new ClientBuilder(createInitialRequestContext())
  .withCache(new NoOpCache())
  .withCapability(
    withAlgoliaCapabilities(config, {
      productSearch: {
        enabled: true,
        factory: new ExtendedAlgoliaProductSearchFactory(),
      },
    }),
  )
  .build();

client.productSearch
  .queryByTerm({
    search: {
      term: 'test',
      facets: [],
      filters: [],
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    },
  })
  .then((result) => {
    assertNotAny(result);
    if (result.success) {
      assertNotAny(result.value);
      assertNotAny(result.value.extendedMeta);
      assertType<string>(result.value.extendedMeta);
    }
  });
