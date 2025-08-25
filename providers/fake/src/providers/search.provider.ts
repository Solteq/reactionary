import {
  SearchIdentifier,
  SearchMutation,
  SearchProvider,
  SearchQuery,
  SearchResult,
  SearchResultFacet,
  SearchResultProduct,
  Session,
} from '@reactionary/core';
import z from 'zod';
import { FakeConfiguration } from '../schema/configuration.schema';
import { Faker, en, base } from '@faker-js/faker';
import { jitter } from '../utilities/jitter';

export class FakeSearchProvider<
  T extends SearchResult = SearchResult,
  Q extends SearchQuery = SearchQuery,
  M extends SearchMutation = SearchMutation
> extends SearchProvider<T, Q, M> {
  protected config: FakeConfiguration;

  constructor(config: FakeConfiguration, schema: z.ZodType<T>, querySchema: z.ZodType<Q, Q>, mutationSchema: z.ZodType<M, M>, cache: any) {
    super(schema, querySchema, mutationSchema, cache);

    this.config = config;
  }

  protected override async fetch(queries: Q[], session: Session): Promise<T[]> {
    const results = [];

    for (const query of queries) {
      const result = await this.get(query.search);

      results.push(result);
    }

    return results;
  }

  protected override process(mutations: M[], session: Session): Promise<T> {
    throw new Error('Method not implemented.');
  }

  public async get(identifier: SearchIdentifier): Promise<T> {
    await jitter(this.config.jitter.mean, this.config.jitter.deviation);

    return this.parse({}, identifier);
  }

  public parse(data: unknown, query: SearchIdentifier): T {
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
        image: {
          url: productGenerator.image.urlPicsumPhotos({
            height: 300,
            width: 300,
            grayscale: true,
            blur: 8
          }),
          title: productGenerator.commerce.productName(),
          height: 300,
          width: 300
        },
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
          key: ''
        },
        placeholder: false
      }
    } satisfies SearchResult;

    return this.schema.parse(result);
  }
}
