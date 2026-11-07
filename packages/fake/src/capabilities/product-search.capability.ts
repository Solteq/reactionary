import {
  ImageSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
  ProductSearchResultItemSchema,
  ProductSearchResultSchema,
  Reactionary,
  success,
  error,
  getActiveTypedSearchFilters,
  getSearchFilterProblem,
  type InvalidInputError,
  type SearchIdentifier,
  type TypedSearchFilter,
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

/** The fake can apply every typed filter, it only refuses facets that name the key of a typed field. */
const FAKE_SUPPORTED_FILTERS: TypedSearchFilter[] = ['conceptContext', 'conceptFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'];

const ATTRIBUTE_FACETS = [
  { key: 'color', multiselect: false },
  { key: 'size', multiselect: true },
];

const FEATURE_CONCEPTS = [
  { key: 'features/cordless', name: 'Cordless', count: 12 },
  { key: 'features/waterproof', name: 'Waterproof', count: 7 },
  { key: 'features/wireless', name: 'Wireless', count: 4 },
];

const FAKE_STORE_KEY = 'store_1';

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

    const problem = getSearchFilterProblem(query, FAKE_SUPPORTED_FILTERS);
    if (problem !== undefined) {
      return error<InvalidInputError>({ type: 'InvalidInput', error: problem });
    }

    const typedFilterCount = getActiveTypedSearchFilters(query).length;
    const querySpecificity =
      20 -
      query.term.length -
      query.paginationOptions.pageNumber -
      query.facets.length -
      typedFilterCount;
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
          canAddToCartDirectly: true,
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

    facets.push(...this.createFacets(query, facetGenerator));

    const result = {
      identifier: {
        term: query.term,
        paginationOptions: {
          pageNumber: query.paginationOptions.pageNumber,
          pageSize: query.paginationOptions.pageSize,
        },
        facets: query.facets,
        conceptContext: query.conceptContext,
        conceptFilter: query.conceptFilter,
        priceFilter: query.priceFilter,
        ratingFilter: query.ratingFilter,
        availabilityFilter: query.availabilityFilter,
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

  /**
   * Deterministic facets of every kind, with `active` derived from the typed filters of the search.
   */
  protected createFacets(query: SearchIdentifier, facetGenerator: Faker): ProductSearchResultFacet[] {
    const facets: ProductSearchResultFacet[] = [];

    for (const attribute of ATTRIBUTE_FACETS) {
      const values = [];
      for (let i = 0; i < 10; i++) {
        const valueKey = i.toString();
        values.push({
          active: query.facets.some((x) => x.facet.key === attribute.key && x.key === valueKey),
          count: facetGenerator.number.int({ min: 1, max: 50 }),
          identifier: { facet: { key: attribute.key }, key: valueKey },
          name: facetGenerator.color.human(),
        });
      }
      facets.push({
        semantic: 'attribute',
        identifier: { key: attribute.key },
        name: attribute.key,
        multiselect: attribute.multiselect,
        values,
      });
    }

    const selectedConcepts = query.conceptFilter ?? [];
    facets.push({
      semantic: 'taxonomy',
      vocabulary: 'features',
      name: 'Features',
      multiselect: true,
      values: FEATURE_CONCEPTS.map((concept) => ({
        concept: { key: concept.key },
        name: concept.name,
        count: concept.count,
        active: selectedConcepts.some((x) => x.key === concept.key),
      })),
    });

    const priceFilter = query.priceFilter;
    const hasPriceFilter = priceFilter?.min !== undefined || priceFilter?.max !== undefined;
    facets.push({
      semantic: 'price',
      name: 'Price',
      multiselect: false,
      currency: this.context.languageContext.currencyCode,
      stats: { min: 5, max: 500 },
      ...(hasPriceFilter ? { selected: priceFilter } : {}),
    });

    const ratingLow = query.ratingFilter?.min ?? 0;
    const ratingHigh = query.ratingFilter?.max ?? 5;
    const hasRatingFilter = query.ratingFilter?.min !== undefined || query.ratingFilter?.max !== undefined;
    facets.push({
      semantic: 'rating',
      name: 'Rating',
      multiselect: false,
      buckets: [1, 2, 3, 4, 5].map((stars) => ({
        min: stars,
        max: stars,
        count: 30 - stars * 4,
        active: hasRatingFilter && stars >= ratingLow && stars <= ratingHigh,
      })),
    });

    facets.push({
      semantic: 'availability',
      name: 'Availability',
      multiselect: true,
      online: { count: 40, active: query.availabilityFilter?.online === true },
      stores: [
        {
          store: { key: FAKE_STORE_KEY },
          name: 'Fake store',
          count: 15,
          active: query.availabilityFilter?.stores?.some((x) => x.key === FAKE_STORE_KEY) ?? false,
        },
      ],
    });

    return facets;
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
