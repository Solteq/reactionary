import {
  ImageSchema,
  ProductSearchProvider,
  ProductSearchQueryByTermSchema,
  ProductSearchResultItemSchema,
  ProductSearchResultSchema,
  Reactionary,
  success,
  error,
} from '@reactionary/core';
import type {
  ProductSearchResult,
  ProductSearchResultFacet,
  ProductSearchResultItem,
  Cache as ReactionaryCache,
  Image,
  FacetIdentifier,
  FacetValueIdentifier,
  ProductSearchResultFacetValue,
  ProductSearchResultItemVariant,
  ProductSearchQueryCreateNavigationFilter,
  Result,
} from '@reactionary/core';
import type {
  RequestContext,
  ProductSearchQueryByTerm,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';
import { jitter } from '../utilities/jitter.js';

export class FakeSearchProvider extends ProductSearchProvider {
  protected config: FakeConfiguration;

  constructor(
    config: FakeConfiguration,
    cache: ReactionaryCache,
    context: RequestContext
  ) {
    super(cache, context);

    this.config = config;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<Result<ProductSearchResult>> {
    await jitter(this.config.jitter.mean, this.config.jitter.deviation);

    const query = payload.search;

    const querySpecificity =
      20 -
      query.term.length -
      query.paginationOptions.pageNumber -
      query.facets.length;
    const totalProducts = 10 * querySpecificity;
    const totalPages = Math.ceil(
      totalProducts / query.paginationOptions.pageSize
    );
    const productsOnPage = Math.min(
      totalProducts,
      query.paginationOptions.pageSize
    );

    const productGenerator = new Faker({
      seed: querySpecificity,
      locale: [en, base],
    });

    const facetGenerator = new Faker({
      seed: 100,
      locale: [en, base],
    });

    const products = new Array<ProductSearchResultItem>();
    const facets = new Array<ProductSearchResultFacet>();

    for (let i = 0; i < productsOnPage; i++) {
      const srcUrl = productGenerator.image.urlPicsumPhotos({
        height: 300,
        width: 300,
        grayscale: true,
        blur: 8,
      });

      const img = ImageSchema.parse({
        sourceUrl: srcUrl,
        altText: 'Fake product image',
        height: 300,
        width: 300,
      } satisfies Partial<Image>);

      products.push(
        ProductSearchResultItemSchema.parse({
          identifier: {
            key: 'product_' + productGenerator.commerce.isbn(),
          },
          name: productGenerator.commerce.productName(),
          slug: productGenerator.lorem.slug(),
          variants: [
            {
              variant: {
                sku: productGenerator.commerce.isbn(),
              },
              image: img,
              options: undefined,
            } satisfies Partial<ProductSearchResultItemVariant>,
          ],
        } satisfies Partial<ProductSearchResultItem>)
      );
    }

    const facetBase = ['color', 'size'];

    for (const base of facetBase) {
      const facet: ProductSearchResultFacet = {
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

    const result = ProductSearchResultSchema.parse({
      identifier: {
        term: query.term,
        paginationOptions: {
          pageNumber: query.paginationOptions.pageNumber,
          pageSize: query.paginationOptions.pageSize,
        },
        facets: query.facets,
        filters: [],
      },
      facets: facets,
      items: products,
      pageNumber: query.paginationOptions.pageNumber,
      pageSize: query.paginationOptions.pageSize,
      totalCount: totalProducts,
      totalPages: totalPages,
    } satisfies ProductSearchResult);

    return success(result);
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = {
      key: 'category',
    } satisfies FacetIdentifier;
    const facetValueIdentifier = {
      facet: facetIdentifier,
      key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
    } satisfies FacetValueIdentifier;

    return success(facetValueIdentifier);
  }

  protected override parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number
  ): ProductSearchResultFacetValue {
    throw new Error('Method not implemented.');
  }
  protected override parseFacet(
    facetIdentifier: FacetIdentifier,
    facetValue: unknown
  ): ProductSearchResultFacet {
    throw new Error('Method not implemented.');
  }
  protected override parseVariant(
    variant: unknown,
    product: unknown
  ): ProductSearchResultItemVariant {
    throw new Error('Method not implemented.');
  }
}
