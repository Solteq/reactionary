import type {
  ProductSearchFacetResult as CTProductSearchFacetResult,
  ProductSearchFacetResultBucket as CTProductSearchFacetResultBucket,
  ProductVariant as CTProductVariant,
  ProductPagedSearchResponse,
  ProductProjection,
  ProductSearchFacetExpression,
} from '@commercetools/platform-sdk';
import type {
  Cache,
  FacetIdentifier,
  FacetValueIdentifier,
  ProductOptionIdentifier,
  ProductSearchQueryByTerm,
  ProductSearchQueryCreateNavigationFilter,
  ProductSearchResult,
  ProductSearchResultFacet,
  ProductSearchResultFacetValue,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  ProductVariantIdentifier,
  ProductVariantOption,
  RequestContext,
  Result,
  SearchIdentifier,
} from '@reactionary/core';
import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductOptionIdentifierSchema,
  ProductSearchProvider,
  ProductSearchQueryByTermSchema,
  ProductSearchQueryCreateNavigationFilterSchema,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemVariantSchema,
  ProductSearchResultSchema,
  ProductVariantIdentifierSchema,
  ProductVariantOptionSchema,
  Reactionary,
  success,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';

import createDebug from 'debug';
import type { CommercetoolsClient } from '../core/client.js';
import { CommercetoolsCategoryLookupSchema,  CommercetoolsResolveCategoryQueryByIdSchema, CommercetoolsResolveCategoryQueryByKeySchema, type CommercetoolsCategoryLookup, type CommercetoolsResolveCategoryQueryById, type CommercetoolsResolveCategoryQueryByKey } from '../schema/commercetools.schema.js';

const debug = createDebug('reactionary:commercetools:search');

export class CommercetoolsSearchProvider extends ProductSearchProvider {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client
      .withProjectKey({ projectKey: this.config.projectKey })
      .products();
  }

  protected async getFacetQuery(
    payload: ProductSearchQueryByTerm,
    selectedFacetValue: FacetValueIdentifier
  ) {

    if (selectedFacetValue.facet.key === 'categories') {
      // const category = await this.resolveCategoryFromKey({ key: selectedFacetValue.key });
      return {
        exact: {
          field: 'categoriesSubTree',
          values: [selectedFacetValue.key],
          fieldType: 'text',
        },
      };
    }

    return {
      exact: {
        field: selectedFacetValue.facet.key,
        fieldType: 'text',
        value: selectedFacetValue.key,
      },
    };
  }

  protected async resolveCategoryFromId(payload: CommercetoolsResolveCategoryQueryById): Promise<CommercetoolsCategoryLookup> {
    const client = (await this.client.getClient()).withProjectKey({ projectKey: this.config.projectKey });

    const response = await client.categories().withId({ ID: payload.id }).get().execute();
    if (!response.body || !response.body.name) {
      throw new Error(`Category with ID ${payload.id} not found`);
    }

    const result: CommercetoolsCategoryLookup = {
      id: response.body.id,
      key: response.body.key,
      name: response.body.name,
      meta: {
        cache: {
          hit: false,
          key: 'commercetools-internal-category-from-id-' + payload.id,
        },
        placeholder: false,
      }
    };
    return result;
  }

  @Reactionary({
    inputSchema: CommercetoolsResolveCategoryQueryByKeySchema,
    outputSchema: CommercetoolsCategoryLookupSchema,
  })
  protected async resolveCategoryFromKey(payload: CommercetoolsResolveCategoryQueryByKey): Promise<CommercetoolsCategoryLookup> {
    const client = (await this.client.getClient()).withProjectKey({ projectKey: this.config.projectKey });

    const response = await client.categories().withKey({ key: payload.key }).get().execute();
    if (!response.body || !response.body.name) {
      throw new Error(`Category with key ${payload.key} not found`);
    }
    const result = {
      id: response.body.id,
      key: response.body.key,
      name: response.body.name,
      meta: {
        cache: {
          hit: false,
          key: 'commercetools-internal-category-from-key-' + payload.key,
        },
        placeholder: false,
      }
    };
    return result;
  }



  protected async getCategoryFilterExpression(
    payload: ProductSearchQueryByTerm
  ) {
    if (!payload.search.categoryFilter) {
      return undefined;
    }
    // const category = await this.resolveCategoryFromKey({ key: payload.search.categoryFilter.key });
    if (payload.search.categoryFilter.key) {
      return {
        exact: {
          field: 'categoriesSubTree',
          values: [payload.search.categoryFilter.key],
          fieldType: 'text',
        },
      };
    }
    return undefined;
  }

  protected async getSearchTermExpression(payload: ProductSearchQueryByTerm) {
    if (payload.search.term.trim().length === 0 || payload.search.term === '*') {
      return undefined;
    }

    return {
      or: [
        {
          fullText: {
            field: 'name',
            language: `${this.context.languageContext.locale}`,
            value: payload.search.term,
          },
        },
        {
          fullText: {
            field: 'description',
            language: `${this.context.languageContext.locale}`,
            value: payload.search.term,
          },
        },
        {
          fullText: {
            field: 'searchKeywords',
            language: `${this.context.languageContext.locale}`,
            value: payload.search.term,
          },
        },
      ],
    };
  }

  protected async getFacetsQuery(payload: ProductSearchQueryByTerm) {
    if (payload.search.facets.length === 0) {
      return undefined;
    }

    const facetsToApply = await Promise.all(
      payload.search.facets.map((facet) => this.getFacetQuery(payload, facet))
    );

    if (facetsToApply.length === 0) {
      return undefined;
    }
    if (facetsToApply.length === 1) {
      return facetsToApply[0];
    }
    return {
      and: facetsToApply,
    };
  }

  protected async getFacetsToReturn(
    payload: ProductSearchQueryByTerm
  ): Promise<ProductSearchFacetExpression[]> {
    const facetsToReturn: ProductSearchFacetExpression[] = [];

    const configFacets = ['categories', ...this.config.facetFieldsForSearch];

    // the default behavior is to get a static list of facets from the config. In more advanced implementations, this could be dynamic based on the payload, ie based on category maybe
    for (const facet of configFacets) {
      facetsToReturn.push({
        distinct: {
          name: facet,
          field: facet,
          fieldType: 'text',
          limit: 50,
        },
      });
    }

    return facetsToReturn;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryCreateNavigationFilterSchema,
    outputSchema: FacetValueIdentifierSchema,
  })
  public override async createCategoryNavigationFilter(payload: ProductSearchQueryCreateNavigationFilter): Promise<Result<FacetValueIdentifier>> {
    // In Commercetools, we can use the category ID to filter products by category

    const categoryPath = payload.categoryPath;
    const deepestCategory = categoryPath[categoryPath.length - 1];
    const resolvedCategory = await this.resolveCategoryFromKey({ key: deepestCategory.identifier.key });
    const resolvedId = resolvedCategory?.id;
    const facetIdentifier: FacetIdentifier = {
      key: 'categories',
    }
    const facetValueIdentifier: FacetValueIdentifier = {
      facet: facetIdentifier,
      key: resolvedId || 'unknown',
    };

    return success(facetValueIdentifier);
  }



  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<Result<ProductSearchResult>> {
    const client = await this.getClient();

    const facetsToReturn = await this.getFacetsToReturn(payload);
    const facetsToApply = await this.getFacetsQuery(payload);
    const searchTermExpression = await this.getSearchTermExpression(payload);
    const categoryFilterExpression = await this.getCategoryFilterExpression(payload);

    let finalFilterExpression: any = undefined;
    if (searchTermExpression) {
      finalFilterExpression = searchTermExpression;
    }

    if (facetsToApply) {
      if (finalFilterExpression) {
        finalFilterExpression = {
          and: [finalFilterExpression, facetsToApply],
        };
      } else {
        finalFilterExpression = facetsToApply;
      }
    }

    if (categoryFilterExpression) {
      if (finalFilterExpression) {
        finalFilterExpression = {
          and: [finalFilterExpression, categoryFilterExpression],
        };
      } else {
        finalFilterExpression = categoryFilterExpression;
      }
    }

    const response = await client
      .search()
      .post({
        body: {
          query: finalFilterExpression,
          productProjectionParameters: {
            storeProjection: this.context.storeIdentifier.key,
          },
          limit: payload.search.paginationOptions.pageSize,
          offset:
            (payload.search.paginationOptions.pageNumber - 1) *
            payload.search.paginationOptions.pageSize,

          facets: [...facetsToReturn],
        },
      })
      .execute();

    const responseBody = response.body;
    const result = this.parsePaginatedResult(
      responseBody,
      payload
    ) as ProductSearchResult;


    // ok, we have to patch up the categories facet to have the category keys instead of ids
    await this.patchCategoryFacetValues(result);


    // mark selected facets as active
    for(const selectedFacet of payload.search.facets) {
      const facet = result.facets.find((f) => f.identifier.key === selectedFacet.facet.key);
      if(facet) {
          const value = facet.values.find((v) => v.identifier.key === selectedFacet.key);
          if(value) {
            value.active = true;
          }
        }
    }


    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${responseBody.results.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    return success(result);
  }

  protected async patchCategoryFacetValues(result: ProductSearchResult) {
    const categoryFacet = result.facets.find(
      (f) => f.identifier.key === 'categories'
    );
    if (!categoryFacet) {
      return;
    }

    const resolvedCategories = categoryFacet.values.map((facetValue) => this.resolveCategoryFromId({ id: facetValue.identifier.key }));
    const categories = await Promise.all(resolvedCategories);
    for (const facetValue of categoryFacet.values) {
      try {
        const category = categories.find((c) => c.id === facetValue.identifier.key);
        if (!category) {
          continue;
        }
        facetValue.name = category.name[this.context.languageContext.locale] || category.id;
      } catch (error) {
        if (debug.enabled) {
          debug(`Error resolving category key for id ${facetValue.identifier.key}:`, error);
        }
      }
    }
  }


  protected parseSingle(body: ProductProjection) {
    const identifier = { key: body.id };
    const name = body.name[this.context.languageContext.locale] || body.id;
    const slug = body.slug?.[this.context.languageContext.locale] || body.id;
    const variants = [body.masterVariant, ...body.variants].map((variant) =>
      this.parseVariant(variant, body)
    );

    const product = {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;

    return product;
  }

  protected parsePaginatedResult(
    body: ProductPagedSearchResponse,
    query: ProductSearchQueryByTerm
  ) {
    const identifier = {
      ...query.search,
    } satisfies SearchIdentifier;

    const products: ProductSearchResultItem[] = body.results.map((p) =>
      this.parseSingle(p.productProjection!)
    );
    const facets: ProductSearchResultFacet[] = [];

    for (const facet of body.facets) {
      const facetIdentifier = FacetIdentifierSchema.parse({
        key: facet.name,
      } satisfies Partial<FacetIdentifier>);

      const candidateFacet = this.parseFacet(facetIdentifier, facet);
      if (candidateFacet.values.length > 0) {
        facets.push(candidateFacet);
      }
    }

    const result = {
      identifier,
      pageNumber: (Math.ceil(body.offset / body.limit) || 0) + 1,
      pageSize: body.limit,
      totalCount: body.total || 0,
      totalPages: Math.ceil((body.total || 0) / body.limit || 0) + 1,
      items: products,
      facets,
    } satisfies ProductSearchResult;

    return result;
  }

  /**
   * See version 0.0.81 for ProductProjection based facet parsing
   * @param facetIdentifier
   * @param facetValue
   * @returns
   */
  protected parseFacet(
    facetIdentifier: FacetIdentifier,
    facet: CTProductSearchFacetResult
  ): ProductSearchResultFacet {
    const result: ProductSearchResultFacet =
      ProductSearchResultFacetSchema.parse({
        identifier: facetIdentifier,
        name: facet.name,
        values: [],
      });

    const distinctFacet = facet as CTProductSearchFacetResultBucket;
    if (distinctFacet) {
      distinctFacet.buckets.forEach((bucket) => {
        const facetValueIdentifier = FacetValueIdentifierSchema.parse({
          facet: facetIdentifier,
          key: bucket.key,
        } satisfies Partial<FacetValueIdentifier>);

        result.values.push(
          this.parseFacetValue(facetValueIdentifier, bucket.key, bucket.count)
        );
      });
    }

    return result;
  }

  protected parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number
  ): ProductSearchResultFacetValue {

    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count: count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }

  protected parseVariant(
    variant: CTProductVariant,
    product: ProductProjection
  ): ProductSearchResultItemVariant {
    const sourceImage = variant.images?.[0];

    const img = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText:
        sourceImage?.label ||
        product.name[this.context.languageContext.locale] ||
        undefined,
    });

    const mappedOptions =
      variant.attributes
        ?.filter((x) => x.name === 'Color')
        .map((opt) =>
          ProductVariantOptionSchema.parse({
            identifier: ProductOptionIdentifierSchema.parse({
              key: opt.name,
            } satisfies Partial<ProductOptionIdentifier>),
            name: opt.value || '',
          } satisfies Partial<ProductVariantOption>)
        ) || [];

    const mappedOption = mappedOptions?.[0];

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
      options: mappedOption,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }
}
