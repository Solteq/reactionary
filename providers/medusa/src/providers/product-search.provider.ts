import {
  ProductSearchProvider,
  ProductSearchQueryByTermSchema,
  type Cache,
  type RequestContext,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
  type ProductSearchResultItem,
  ImageSchema,
  ProductVariantIdentifierSchema,
  type ProductVariantIdentifier,
  ProductVariantOptionSchema,
  type ProductVariantOption,
  ProductOptionIdentifierSchema,
  type ProductOptionIdentifier,
  ProductSearchResultItemVariantSchema,
  type ProductSearchResultItemVariant,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  Reactionary,
  ProductSearchResultSchema,
  type ProductSearchQueryCreateNavigationFilter,
  FacetValueIdentifierSchema,
  FacetIdentifierSchema,
  type Result,
  success,
} from '@reactionary/core';
import createDebug from 'debug';
import type z from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaClient } from '../core/client.js';
import type {
  StoreProduct,
  StoreProductCategory,
  StoreProductListResponse,
  StoreProductVariant,
} from '@medusajs/types';

const debug = createDebug('reactionary:medusa:search');

export class MedusaSearchProvider extends ProductSearchProvider {
  protected config: MedusaConfiguration;

  constructor(
    config: MedusaConfiguration,
    cache: Cache,
    context: RequestContext,
    public client: MedusaClient
  ) {
    super(cache, context);
    this.config = config;
  }

  protected async resolveCategoryIdByExternalId(
    externalId: string
  ): Promise<StoreProductCategory | null> {
    const sdk = await this.client.getClient();
    let offset = 0;
    const limit = 50;
    let candidate: StoreProductCategory | undefined = undefined;
    while (true) {
      try {
        const categoryResult = await sdk.store.category.list({
          offset,
          limit,
        });

        if (categoryResult.product_categories.length === 0) {
          break;
        }

        candidate = categoryResult.product_categories.find(
          (cat) => cat.metadata?.['external_id'] === externalId
        );
        if (candidate) {
          break;
        }
        offset += limit;
      } catch (error) {
        throw new Error(
          'Category not found ' + externalId + ' due to error: ' + error
        );
        break;
      }
    }
    return candidate || null;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<Result<ProductSearchResult>> {
    const client = await this.client.getClient();

    let categoryIdToFind: string | null = null;
    if (payload.search.categoryFilter?.key) {
      debug(
        `Resolving category filter for key: ${payload.search.categoryFilter.key}`
      );

      const category = await this.resolveCategoryIdByExternalId(
        payload.search.categoryFilter.key
      );
      if (category) {
        categoryIdToFind = category.id;
        debug(
          `Resolved category filter key ${payload.search.categoryFilter.key} to id: ${categoryIdToFind}`
        );
      } else {
        debug(
          `Could not resolve category filter for key: ${payload.search.categoryFilter.key}`
        );
      }
    }
    const finalSearch = (payload.search.term || '').trim().replace('*', '');
    const response = await client.store.product.list({
      q: finalSearch,
      ...(categoryIdToFind ? { category_id: categoryIdToFind } : {}),
      limit: payload.search.paginationOptions.pageSize,
      offset:
        (payload.search.paginationOptions.pageNumber - 1) *
        payload.search.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response) as ProductSearchResult;
    if (debug.enabled) {
      debug(
        `Search for term "${payload.search.term}" returned ${response.products.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`
      );
    }

    // Set result metadata
    result.identifier = {
      ...payload.search,
    };

    return success(result);
  }

  protected parsePaginatedResult(remote: StoreProductListResponse) {
    // Parse facets
    // no facets available from Medusa at the moment

    const products: ProductSearchResultItem[] = remote.products.map((p) =>
      this.parseSingle(p)
    );

    const result = {
      identifier: {
        facets: [],
        filters: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 0,
        },
        term: '',
      },
      pageNumber: (Math.ceil(remote.offset / remote.limit) || 0) + 1,
      pageSize: remote.limit,
      totalCount: remote.count,
      totalPages: Math.ceil(remote.count / remote.limit || 0) + 1,
      items: products,
      facets: [],
    } satisfies ProductSearchResult;

    (result as ProductSearchResult).facets = [];
    return result;
  }

  protected parseSingle(_body: StoreProduct): ProductSearchResultItem {
    const heroVariant = _body.variants?.[0];
    const identifier = { key: _body.id };
    const slug = _body.handle;
    const name = heroVariant?.title || _body.title;
    const variants = [];
    if (heroVariant) {
      variants.push(this.parseVariant(heroVariant, _body));
    }

    const result = {
      identifier,
      name,
      slug,
      variants,
    } satisfies ProductSearchResultItem;

    return result;
  }

  protected parseVariant(
    variant: StoreProductVariant,
    product: StoreProduct
  ): ProductSearchResultItemVariant {
    const img = ImageSchema.parse({
      sourceUrl: product.images?.[0].url ?? '',
      altText: product.title || undefined,
    });

    const mappedOptions =
      variant.options
        ?.filter((x) => x.option?.title === 'Color')
        .map((opt) =>
          ProductVariantOptionSchema.parse({
            identifier: ProductOptionIdentifierSchema.parse({
              key: opt.option_id!,
            } satisfies Partial<ProductOptionIdentifier>),
            name: opt.value || '',
          } satisfies Partial<ProductVariantOption>)
        ) || [];

    const mappedOption = variant.options?.[0];

    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({
        sku: variant.sku || '',
      } satisfies ProductVariantIdentifier),
      image: img,
    } satisfies Partial<ProductSearchResultItemVariant>);
  }

  public override async createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter
  ): Promise<Result<FacetValueIdentifier>> {
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories',
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath[payload.categoryPath.length - 1].identifier.key,
    });

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
}
