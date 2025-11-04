import { createPaginatedResponseSchema, FacetIdentifierSchema, FacetValueIdentifierSchema, ImageSchema, ProductOptionIdentifierSchema, ProductSearchProvider, ProductSearchResultFacetSchema, ProductSearchResultFacetValueSchema, ProductSearchResultItemVariantSchema, ProductVariantIdentifierSchema, ProductVariantOptionSchema } from '@reactionary/core';
import type {
  Cache,
  ProductSearchQueryByTerm,
  RequestContext,
  ProductSearchResultItem,
  ProductSearchResult,
  ProductSearchResultItemVariant,
  ProductOptionIdentifier,
  ProductVariantOption,
  ProductVariantIdentifier,
  FacetIdentifier,
  ProductSearchResultFacet,
  FacetValueIdentifier,
  ProductSearchResultFacetValue,
} from '@reactionary/core';

import { CommercetoolsClient } from '../core/client.js';
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { ProductVariant as CTProductVariant, FacetResult, ProductProjection, ProductProjectionPagedSearchResponse } from '@commercetools/platform-sdk';

import createDebug from 'debug';
const debug = createDebug('reactionary:commercetools:search');

export class CommercetoolsSearchProvider<
  T extends ProductSearchResultItem = ProductSearchResultItem
> extends ProductSearchProvider<T> {
  protected config: CommercetoolsConfiguration;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache
  ) {
    super(schema, cache);

    this.config = config;
  }

  protected async getClient(reqCtx: RequestContext) {
    const client = await new CommercetoolsClient(this.config).getClient(reqCtx);
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }


  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
    reqCtx: RequestContext
  ): Promise<ProductSearchResult> {
    const client = await this.getClient(reqCtx);

    const response = await client
      .search()
      .get({
        queryArgs: {
          limit: payload.search.paginationOptions.pageSize,
          offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
          [`text.${reqCtx.languageContext.locale}`]: payload.search.term,
        },
      })
      .execute();
    const responseBody = response.body;

    const result = this.parsePaginatedResult(responseBody, reqCtx) as ProductSearchResult;

    if (debug.enabled) {
      debug(`Search for term "${payload.search.term}" returned ${responseBody.results.length} products (page ${payload.search.paginationOptions.pageNumber} of ${result.totalPages})`);
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

  protected override parseSingle(body: ProductProjection, reqCtx: RequestContext) {

    const product = this.newModel();

    product.identifier = { key: body.id};
    product.name = body.name[reqCtx.languageContext.locale] || body.id;
    product.slug = body.slug?.[reqCtx.languageContext.locale] || body.id;
    product.variants = [ body.masterVariant,  ...body.variants ].map(variant => this.parseVariant(variant, body, reqCtx));

    return product;
  }

  protected override parsePaginatedResult(body: ProductProjectionPagedSearchResponse, reqCtx: RequestContext) {

    const products: ProductSearchResultItem[] = body.results.map((p) => this.parseSingle(p, reqCtx));
    const facets: ProductSearchResultFacet[] = [];

    for (const id in body.facets) {
      const f = body.facets[id];
      const facetId = FacetIdentifierSchema.parse({
        key: id
      })
      const facet = this.parseFacet(facetId, f, reqCtx);
      facets.push(facet);
    }

    const result = createPaginatedResponseSchema(this.schema).parse({
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false
      },
      pageNumber: ( Math.ceil(body.offset / body.limit )  || 0) + 1,
      pageSize: body.limit,
      totalCount: body.total,
      totalPages: Math.ceil(((body.total || 0) / body.limit) || 0) + 1,
      items: products,
    });

    (result as ProductSearchResult).facets = facets;
    return result;
  }


  protected parseFacet(facetIdentifier: FacetIdentifier,  facetValue: FacetResult, reqCtx: RequestContext) : ProductSearchResultFacet {

    const result: ProductSearchResultFacet = ProductSearchResultFacetSchema.parse({
      identifier: facetIdentifier,
      name: facetIdentifier.key,
      values: []
    });
    if (facetValue.type === 'terms') {
      for (const ft of facetValue.terms) {
        const facetValueIdentifier = FacetValueIdentifierSchema.parse({
          facet: facetIdentifier,
          key: ft.term
        } satisfies Partial<FacetValueIdentifier>);

        result.values.push(this.parseFacetValue(facetValueIdentifier, ft.term, ft.count, reqCtx));
      }
    }
    return result;
  }

  protected parseFacetValue(facetValueIdentifier: FacetValueIdentifier,  label: string, count: number, reqCtx: RequestContext) : ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count: count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }



  protected parseVariant(variant: CTProductVariant, product: ProductProjection, reqCtx: RequestContext): ProductSearchResultItemVariant {

    const sourceImage = variant.images?.[0];

    const img = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText: sourceImage?.label || product.name[reqCtx.languageContext.locale]  || undefined,
    });

    const mappedOptions = variant.attributes?.filter(x => x.name === 'Color').map((opt) =>  ProductVariantOptionSchema.parse({
          identifier: ProductOptionIdentifierSchema.parse({
            key: opt.name,
          } satisfies Partial<ProductOptionIdentifier>),
          name: opt.value || '',
          } satisfies Partial<ProductVariantOption>
        )
      ) || [];

    const mappedOption = mappedOptions?.[0];


    return ProductSearchResultItemVariantSchema.parse({
      variant: ProductVariantIdentifierSchema.parse({ sku: variant.sku || '' } satisfies ProductVariantIdentifier ),
      image: img,
      option: mappedOption,
     } satisfies Partial<ProductSearchResultItemVariant>);
  }




}
