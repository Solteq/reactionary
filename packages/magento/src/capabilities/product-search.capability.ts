import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchCapability,
  ProductSearchQueryByTermSchema,
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
  type ProductSearchResultFacetValue,
  type RequestContext,
  type Result,
} from '@reactionary/core';
import createDebug from 'debug';
import type { MagentoConfiguration } from '../schema/configuration.schema.js';
import type { MagentoClient } from '../core/client.js';
import type { MagentoProductSearchFactory } from '../factories/product-search/product-search.factory.js';

const debug = createDebug('reactionary:magento:search');

/** Facet key {@link MagentoProductSearchCapability.createCategoryNavigationFilter} encodes categories with. */
const CATEGORY_FACET_KEY = 'categories';
const CATEGORY_FIELD = 'category_id';

interface MagentoSearchFilter {
  field: string;
  value: string;
  conditionType: 'eq' | 'in' | 'like';
}

export class MagentoProductSearchCapability<
  TFactory extends ProductSearchFactory = MagentoProductSearchFactory,
> extends ProductSearchCapability<ProductSearchFactoryOutput<TFactory>> {
  protected config: MagentoConfiguration;
  protected factory: ProductSearchFactoryWithOutput<TFactory>;

  constructor(
    config: MagentoConfiguration,
    cache: Cache,
    context: RequestContext,
    public magentoApi: MagentoClient,
    factory: ProductSearchFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
    cache: true,
    cacheTimeToLiveInSeconds: 300,
    currencyDependentCaching: false,
    localeDependentCaching: true,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<ProductSearchFactoryOutput<TFactory>>> {
    const finalSearch = (payload.search.term || '').trim().replace('*', '');
    const pageSize = payload.search.paginationOptions.pageSize;
    const currentPage = payload.search.paginationOptions.pageNumber;

    const params = new URLSearchParams();
    const filterGroups: MagentoSearchFilter[][] = [];

    if (finalSearch) {
      filterGroups.push([{ field: 'name', value: `%${finalSearch}%`, conditionType: 'like' }]);
    }

    if (payload.search.categoryFilter?.key) {
      debug(`Applying category filter: ${payload.search.categoryFilter.key}`);
      filterGroups.push([
        { field: CATEGORY_FIELD, value: payload.search.categoryFilter.key, conditionType: 'eq' },
      ]);
    }

    filterGroups.push(...this.getFacetFilterGroups(payload.search.facets));
    filterGroups.push(...this.getStorefrontScopeFilterGroups());

    filterGroups.forEach((filters, groupIndex) => {
      filters.forEach((filter, filterIndex) => {
        const prefix = `searchCriteria[filterGroups][${groupIndex}][filters][${filterIndex}]`;
        params.set(`${prefix}[field]`, filter.field);
        params.set(`${prefix}[value]`, filter.value);
        params.set(`${prefix}[condition_type]`, filter.conditionType);
      });
    });

    params.set('searchCriteria[pageSize]', String(pageSize));
    params.set('searchCriteria[currentPage]', String(currentPage));

    const client = await this.magentoApi.getClient();
    const response = await client.store.product.search(params);

    const result = this.factory.parseSearchResult(this.context, response, payload);

    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.items?.length ?? 0} products (page ${currentPage} of ${(result as ProductSearchResult).totalPages})`,
      );
    }

    return success(result);
  }

  /**
   * One filter group per facet code: Magento ORs the filters within a group and ANDs
   * the groups, so values of one facet widen the result and distinct facets narrow it.
   * The facet code is the Magento attribute code and the facet value key its (option) value;
   * the category navigation facet created by {@link createCategoryNavigationFilter} maps onto `category_id`.
   */
  protected getFacetFilterGroups(facets: FacetValueIdentifier[]): MagentoSearchFilter[][] {
    const groups = new Map<string, MagentoSearchFilter[]>();
    for (const facetValue of facets) {
      const field =
        facetValue.facet.key === CATEGORY_FACET_KEY ? CATEGORY_FIELD : facetValue.facet.key;
      const group = groups.get(field) ?? [];
      group.push({ field, value: facetValue.key, conditionType: 'eq' });
      groups.set(field, group);
    }
    return [...groups.values()];
  }

  /**
   * Restricts results to what a storefront may show: enabled products that are visible in
   * the catalog (visibility 2 = Catalog, 4 = Catalog, Search). The admin REST product search
   * does not apply this itself, so without it disabled products and "Not Visible
   * Individually" (1) configurable children would be listed.
   */
  protected getStorefrontScopeFilterGroups(): MagentoSearchFilter[][] {
    return [
      [{ field: 'status', value: '1', conditionType: 'eq' }],
      [{ field: 'visibility', value: '2,4', conditionType: 'in' }],
    ];
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: CATEGORY_FACET_KEY,
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
    });

    return success(facetValueIdentifier);
  }

  protected parseFacetValue(
    _facetValueIdentifier: FacetValueIdentifier,
    _label: string,
    _count: number,
  ): ProductSearchResultFacetValue {
    throw new Error('Method not implemented.');
  }

  protected parseFacet(
    _facetIdentifier: FacetIdentifier,
    _facetValue: unknown,
  ): ProductSearchResultFacet {
    throw new Error('Method not implemented.');
  }

  protected parseVariant(): never {
    throw new Error('Method not implemented.');
  }
}
