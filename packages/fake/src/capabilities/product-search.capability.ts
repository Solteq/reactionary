import {
  ImageSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
  ProductSearchResultItemSchema,
  ProductSearchResultSchema,
  Reactionary,
  success,
  type Cache,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchFactory,
  type ProductSearchFactoryOutput,
  type ProductSearchFactoryWithOutput,
  type ProductSearchQueryByTerm,
  type ProductSearchQueryCreateNavigationFilter,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import { Faker, en, base } from '@faker-js/faker';
import { jitter } from '../utilities/jitter.js';
import type { FakeProductSearchFactory } from '../factories/product-search/product-search.factory.js';

export class FakeProductSearchCapability<
  TFactory extends ProductSearchFactory = FakeProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: FakeConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);

    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    await jitter(this.config.jitter.mean, this.config.jitter.deviation);

    const query = payload.search;

    const querySpecificity =
      20 - query.term.length - query.paginationOptions.pageNumber - query.facets.length;
    const totalProducts = 10 * querySpecificity;
    const totalPages = Math.ceil(totalProducts / query.paginationOptions.pageSize);
    const productsOnPage = Math.min(totalProducts, query.paginationOptions.pageSize);

    const productGenerator = new Faker({
      seed: querySpecificity,
      locale: [en, base],
    });

    const facetGenerator = new Faker({
      seed: 100,
      locale: [en, base],
    });

    const products: ProductSearchResultItem[] = [];
    const facets: ProductSearchResultFacet[] = [];

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
      });

      products.push(
        ProductSearchResultItemSchema.parse({
          identifier: {
            key: `product_${productGenerator.commerce.isbn()}`,
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
        }),
      );
    }

    for (const baseFacet of ['color', 'size']) {
      const facet: ProductSearchResultFacet = {
        identifier: {
          key: baseFacet,
        },
        name: baseFacet,
        values: [],
      };

      for (let i = 0; i < 10; i++) {
        const valueKey = i.toString();
        const isActive =
          query.facets.find(
            (x) => x.facet.key === facet.identifier.key && x.key === valueKey,
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
      identifier: {
        term: query.term,
        paginationOptions: {
          pageNumber: query.paginationOptions.pageNumber,
          pageSize: query.paginationOptions.pageSize,
        },
        facets: query.facets,
        filters: [],
      },
      facets,
      items: products,
      pageNumber: query.paginationOptions.pageNumber,
      pageSize: query.paginationOptions.pageSize,
      totalCount: totalProducts,
      totalPages,
    } satisfies ProductSearchResult;

    return success(this.factory.parseSearchResult(this.context, result, payload));
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
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

}
