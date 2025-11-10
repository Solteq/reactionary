import { createPaginatedResponseSchema, FacetIdentifierSchema, FacetValueIdentifierSchema, ImageSchema, ProductOptionIdentifierSchema, ProductSearchProvider, ProductSearchQueryByTermSchema, ProductSearchResultFacetSchema, ProductSearchResultFacetValueSchema, ProductSearchResultItemVariantSchema, ProductSearchResultSchema, ProductVariantIdentifierSchema, ProductVariantOptionSchema, Reactionary } from '@reactionary/core';
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
import type z from 'zod';
import type { CommercetoolsConfiguration } from '../schema/configuration.schema.js';
import type { ProductVariant as CTProductVariant, FacetResult, ProductProjection, ProductProjectionPagedSearchResponse } from '@commercetools/platform-sdk';

import createDebug from 'debug';
import type { CommercetoolsClient } from '../core/client.js';
const debug = createDebug('reactionary:commercetools:search');

export class CommercetoolsSearchProvider<
  T extends ProductSearchResultItem = ProductSearchResultItem
> extends ProductSearchProvider<T> {
  protected config: CommercetoolsConfiguration;
  protected client: CommercetoolsClient;

  constructor(
    config: CommercetoolsConfiguration,
    schema: z.ZodType<T>,
    cache: Cache,
    context: RequestContext,
    client: CommercetoolsClient
  ) {
    super(schema, cache, context);

    this.config = config;
    this.client = client;
  }

  protected async getClient() {
    const client = await this.client.getClient();
    return client.withProjectKey({ projectKey: this.config.projectKey }).productProjections();
  }

  @Reactionary({
    inputSchema: ProductSearchQueryByTermSchema,
    outputSchema: ProductSearchResultSchema,
  })
  public override async queryByTerm(
    payload: ProductSearchQueryByTerm
  ): Promise<ProductSearchResult> {
    const client = await this.getClient();

    const response = await client
      .search()
      .get({
        queryArgs: {
          limit: payload.search.paginationOptions.pageSize,
          offset: (payload.search.paginationOptions.pageNumber - 1) * payload.search.paginationOptions.pageSize,
          [`text.${this.context.languageContext.locale}`]: payload.search.term,
        },
      })
      .execute();
    const responseBody = response.body;

    const result = this.parsePaginatedResult(responseBody) as ProductSearchResult;

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

  protected override parseSingle(body: ProductProjection) {

    const product = this.newModel();

    product.identifier = { key: body.id};
    product.name = body.name[this.context.languageContext.locale] || body.id;
    product.slug = body.slug?.[this.context.languageContext.locale] || body.id;
    product.variants = [ body.masterVariant,  ...body.variants ].map(variant => this.parseVariant(variant, body));

    return product;
  }

  protected override parsePaginatedResult(body: ProductProjectionPagedSearchResponse) {

    const products: ProductSearchResultItem[] = body.results.map((p) => this.parseSingle(p));
    const facets: ProductSearchResultFacet[] = [];

    for (const id in body.facets) {
      const f = body.facets[id];
      const facetId = FacetIdentifierSchema.parse({
        key: id
      })
      const facet = this.parseFacet(facetId, f);
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


  protected parseFacet(facetIdentifier: FacetIdentifier,  facetValue: FacetResult) : ProductSearchResultFacet {
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

        result.values.push(this.parseFacetValue(facetValueIdentifier, ft.term, ft.count));
      }
    }
    return result;
  }

  protected parseFacetValue(facetValueIdentifier: FacetValueIdentifier,  label: string, count: number) : ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count: count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }



  protected parseVariant(variant: CTProductVariant, product: ProductProjection): ProductSearchResultItemVariant {

    const sourceImage = variant.images?.[0];

    const img = ImageSchema.parse({
      sourceUrl: sourceImage?.url || '',
      height: sourceImage?.dimensions.h || undefined,
      width: sourceImage?.dimensions.w || undefined,
      altText: sourceImage?.label || product.name[this.context.languageContext.locale]  || undefined,
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
