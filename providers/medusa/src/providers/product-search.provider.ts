import {
  ProductSearchProvider,
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
} from '@reactionary/core';
import createDebug from 'debug';
import type z from 'zod';
import type { MedusaConfiguration } from '../schema/configuration.schema.js';
import { MedusaClient } from '../core/client.js';
import type { StoreProduct, StoreProductListResponse, StoreProductVariant } from '@medusajs/types';

const debug = createDebug('reactionary:medusa:search');

export class MedusaSearchProvider<
  T extends ProductSearchResultItem = ProductSearchResultItem
> extends ProductSearchProvider<T> {
  protected config: MedusaConfiguration;

  constructor(config: MedusaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);
    this.config = config;
  }

  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
    reqCtx: RequestContext
  ): Promise<ProductSearchResult> {

    const client = await new MedusaClient(this.config).getClient(reqCtx);

    const response = await client.store.product.list({
      q: payload.search.term,
      limit: payload.search.paginationOptions.pageSize,
      offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
    });

    const result = this.parsePaginatedResult(response, reqCtx) as ProductSearchResult;
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

  protected override parsePaginatedResult(remote: StoreProductListResponse, reqCtx: RequestContext) {

    // Parse facets
    // no facets available from Medusa at the moment

    const products: ProductSearchResultItem[] = remote.products.map((p) => this.parseSingle(p, reqCtx));


    const result = createPaginatedResponseSchema(this.schema).parse({
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false
      },
      pageNumber: ( Math.ceil(remote.offset / remote.limit )  || 0) + 1,
      pageSize: remote.limit,
      totalCount: remote.count,
      totalPages: Math.ceil((remote.count / remote.limit) || 0) + 1,
      items: products,
    });

    (result as ProductSearchResult).facets = [];
    return result;
  }


  protected override parseSingle(_body: StoreProduct, reqCtx: RequestContext): T {
    const result = this.newModel();

    const heroVariant = _body.variants?.[0];
    result.identifier = { key: _body.id };
    result.slug = _body.handle;
    result.name = heroVariant?.title || _body.title;
    result.variants = [];
    if (heroVariant) {
      result.variants.push(this.parseVariant(heroVariant, _body, reqCtx));
    }

    return this.assert(result);
  }


  protected parseVariant(variant: StoreProductVariant, product: StoreProduct, reqCtx: RequestContext): ProductSearchResultItemVariant {

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
      image: img,
      option: mappedOption,
     } satisfies Partial<ProductSearchResultItemVariant>);
  }

  protected override parseFacetValue(facetValueIdentifier: FacetValueIdentifier, label: string, count: number, reqCtx: RequestContext): ProductSearchResultFacetValue {
    throw new Error('Method not implemented.');
  }
  protected override parseFacet(facetIdentifier: FacetIdentifier, facetValue: unknown, reqCtx: RequestContext): ProductSearchResultFacet {
    throw new Error('Method not implemented.');
  }

}
