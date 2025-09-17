import {
  SearchProvider,
  SearchQueryByTerm,
  SearchResult,
  SearchResultFacet,
  SearchResultProduct,
  Session,
  Cache as ReactionaryCache,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { Faker, en, base } from '@faker-js/faker';
import { jitter } from '../utilities/jitter';
import { trace } from '@opentelemetry/api';
import { traced } from '@reactionary/otel';

export class FakeSearchProvider<
  T extends SearchResult = SearchResult
> extends SearchProvider<T> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: ReactionaryCache) {
    super(schema, cache);

    this.config = config;
  }

  @traced()
  public override async queryByTerm(
    payload: SearchQueryByTerm,
    _session: Session
  ): Promise<SearchResult> {
    await jitter(this.config.jitter.mean, this.config.jitter.deviation);

    const query = payload.search;

    const querySpecificity =
      20 - query.term.length - query.page - query.facets.length;
    const totalProducts = 10 * querySpecificity;
    const totalPages = Math.ceil(totalProducts / query.pageSize);
    const productsOnPage = Math.min(totalProducts, query.pageSize);

    const productGenerator = new Faker({
      seed: querySpecificity,
      locale: [en, base],
    });

    const facetGenerator = new Faker({
      seed: 100,
      locale: [en, base],
    });

    const products = new Array<SearchResultProduct>();
    const facets = new Array<SearchResultFacet>();

    for (let i = 0; i < productsOnPage; i++) {
      products.push({
        identifier: {
          key: productGenerator.commerce.isbn(),
        },
        image: productGenerator.image.urlPicsumPhotos({
          height: 300,
          width: 300,
          grayscale: true,
          blur: 8,
        }),
        name: productGenerator.commerce.productName(),
        slug: productGenerator.lorem.slug(),
      });
    }

    const facetBase = ['color', 'size'];

    for (const base of facetBase) {
      const facet: SearchResultFacet = {
        identifier: {
          key: base,
        },
        name: base,
        values: [],
      };

      for (let i = 0; i < 10; i++) {
        const valueKey = i.toString();
        const isActive =
          query.facets.find(
            (x) => x.facet.key === facet.identifier.key && x.key === valueKey
          ) !== undefined;

        facet.values.push({
          active: isActive,
          count: facetGenerator.number.int({ min: 1, max: 50 }),
          identifier: {
            facet: {
              key: facet.identifier.key,
            },
            key: valueKey,
          },
          name: facetGenerator.color.human(),
        });
      }

      facets.push(facet);
    }

    const result = {
      pages: totalPages,
      identifier: {
        term: query.term,
        page: query.page,
        facets: query.facets,
        pageSize: query.pageSize,
      },
      facets: facets,
      products: products,
      meta: {
        cache: {
          hit: false,
          key: '',
        },
        placeholder: false,
      },
    } satisfies SearchResult;

    return this.schema.parse(result);
  }
}
