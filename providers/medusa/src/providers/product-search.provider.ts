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
  createPaginatedResponseSchema,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  Reactionary,
  ProductSearchResultSchema,
  type Product,
  type Meta,
} from '@reactionary/core';
import createDebug from 'debug';
import type z from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import type { MedusaClient } from '../core/client.js';
import type { StoreProduct, StoreProductListResponse, StoreProductVariant } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:search');

export class MedusaSearchProvider extends ProductSearchProvider {
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, cache: Cache, context: RequestContext, public client: MedusaClient) {
    super(cache, context);
    this.config = config;
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<ProductSearchResult> {
    const client = await this.client.getClient();

    const response = await client.store.product.list({
      q: payload.search.term,
      limit: payload.search.paginationOptions.pageSize,
      offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response) as ProductSearchResult;
    if (debug.enabled) {
      debug(`Search for term "${payload.search.term}" returned ${response.products.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`);
    }

    // Set result metadata
    result.identifier = {
      ...payload.search,
    };

    result.meta = {
      cache: { hit: false, key: ''},
      placeholder: false
    };


    return result;
  }

  protected parsePaginatedResult(remote: StoreProductListResponse) {

    // Parse facets
    // no facets available from Medusa at the moment

    const products: ProductSearchResultItem[] = remote.products.map((p) => this.parseSingle(p));


    const result = {
      identifier: {
        facets: [],
        filters: [],
        paginationOptions: {
          pageNumber: 1,
          pageSize: 0
        },
        term: ''
      },
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false
      },
      pageNumber: ( Math.ceil(remote.offset / remote.limit )  || 0) + 1,
      pageSize: remote.limit,
      totalCount: remote.count,
      totalPages: Math.ceil((remote.count / remote.limit) || 0) + 1,
      items: products,
      facets: []
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
    const meta = {
      cache: {
        hit: false,
        key: ''
      },
      placeholder: false
    } satisfies Meta;

    const result = {
      identifier,
      meta,
      name,
      slug,
      variants
    } satisfies ProductSearchResultItem;

    return result;
  }


  protected parseVariant(variant: StoreProductVariant, product: StoreProduct): ProductSearchResultItemVariant {

    const img = ImageSchema.parse({
      sourceUrl: product.images?.[0].url ?? '',
      altText: product.title || undefined,
    });

    const mappedOptions = variant.options?.filter(x => x.option?.title === 'Color').map((opt) =>  ProductVariantOptionSchema.parse({
          identifier: ProductOptionIdentifierSchema.parse({
            key: opt.option_id!,
          } satisfies Partial<ProductOptionIdentifier>),
          name: opt.value || '',
          } satisfies Partial<ProductVariantOption>
        )
      ) || [];

    const mappedOption = variant.options?.[0];


    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({ sku: variant.sku || '' } satisfies ProductVariantIdentifier ),
      image: img
     } satisfies Partial<ProductSearchResultItemVariant>);
  }

  protected override parseFacetValue(facetValueIdentifier: FacetValueIdentifier, label: string, count: number): ProductSearchResultFacetValue {
    throw new Error('Method not implemented.');
  }
  protected override parseFacet(facetIdentifier: FacetIdentifier, facetValue: unknown): ProductSearchResultFacet {
    throw new Error('Method not implemented.');
  }

}
