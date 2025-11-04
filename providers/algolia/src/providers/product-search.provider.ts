import {
  type Cache,
  createPaginatedResponseSchema,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductSearchProvider,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  ProductSearchResultFacetSchema,
  type ProductSearchResultFacetValue,
  ProductSearchResultFacetValueSchema,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  ProductSearchResultItemVariantSchema,
  type RequestContext
} from '@reactionary/core';
import { algoliasearch, type SearchResponse } from 'algoliasearch';
import type { z } from 'zod';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import { AlgoliaSearchIdentifierSchema, type AlgoliaSearchResult } from '../schema/search.schema.js';

interface AlgoliaNativeVariant {
  variantID: string;
  image: string;
}

interface AlgoliaNativeRecord {
  objectID: string;
  slug?:string;
  name?: string;
  variants: Array<AlgoliaNativeVariant>;
}


export class AlgoliaSearchProvider<
  T extends ProductSearchResultItem = ProductSearchResultItem
> extends ProductSearchProvider<T> {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, schema: z.ZodType<T>, cache: Cache) {
    super(schema, cache);
    this.config = config;
  }

  public override async queryByTerm(
    payload: ProductSearchQueryByTerm,
    reqCtx: RequestContext
  ): Promise<ProductSearchResult> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);
    const remote = await client.search<AlgoliaNativeRecord>({
      requests: [
        {
          indexName: this.config.indexName,
          query: payload.search.term,
          page: payload.search.paginationOptions.pageNumber - 1,
          hitsPerPage: payload.search.paginationOptions.pageSize,
          facets: ['*'],
          analytics: true,
          clickAnalytics: true,
          facetFilters: payload.search.facets.map(
            (x) => `${encodeURIComponent(x.facet.key)}:${x.key}`
          ),
          filters: (payload.search.filters || [])
            .map((x) => `${encodeURIComponent(x)}`)
            .join(' AND '),
        },
      ],
    });

    const input = remote.results[0] as SearchResponse<AlgoliaNativeRecord>;
    const identifier = AlgoliaSearchIdentifierSchema.parse({
      ...payload.search,
      index: input.index,
      key: input.queryID
    });

    const result = this.parsePaginatedResult(input, reqCtx) as AlgoliaSearchResult;
    result.identifier = identifier; // all paginated results should have a .query

    // mark facets active
    for(const selectedFacet of payload.search.facets) {
      const facet = result.facets.find((f) => f.identifier.key === selectedFacet.facet.key);
      if(facet) {
          const value = facet.values.find((v) => v.identifier.key === selectedFacet.key);
          if(value) {
            value.active = true;
          }
        }
    }

    result.meta = {
      cache: { hit: false, key: ''},
      placeholder: false
    };


    return result;
  }


  protected override parseSingle(body: AlgoliaNativeRecord, reqCtx: RequestContext): T {
    const product = this.newModel();

    product.identifier = { key: body.objectID};
    product.name = body.name || body.objectID;
    product.slug = body.slug || body.objectID;
    product.variants = [ ... (body.variants || []) ].map(variant => this.parseVariant(variant, body, reqCtx));

    return this.assert(product);
  }

  protected override parseVariant(variant: AlgoliaNativeVariant, product: AlgoliaNativeRecord, reqCtx: RequestContext): ProductSearchResultItemVariant {



      const result = ProductSearchResultItemVariantSchema.parse({
      variant: {
        sku: variant.variantID
      },
      image: ImageSchema.parse({
        sourceUrl: variant.image,
        altText: product.name || '',
      })
    } satisfies Partial<ProductSearchResultItemVariant>);

    return result;
  }


  protected override parsePaginatedResult(body: SearchResponse<AlgoliaNativeRecord>, reqCtx: RequestContext) {

    const items = body.hits.map((hit) => this.parseSingle(hit, reqCtx));
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
      pageNumber: (body.page || 0) + 1,
      pageSize: body.hitsPerPage,
      totalCount: body.nbHits,
      totalPages: body.nbPages,
      items: items,
    });

    (result as ProductSearchResult).facets = facets;
    return result;
  }

  protected parseFacet(facetIdentifier: FacetIdentifier,  facetValues: Record<string, number>, reqCtx: RequestContext) : ProductSearchResultFacet {
    const result: ProductSearchResultFacet = ProductSearchResultFacetSchema.parse({
      identifier: facetIdentifier,
      name: facetIdentifier.key,
      values: []
    });

    for (const vid in facetValues) {
      const fv = facetValues[vid];

      const facetValueIdentifier = FacetValueIdentifierSchema.parse({
        facet: facetIdentifier,
        key: vid
      } satisfies Partial<FacetValueIdentifier>);

      result.values.push(this.parseFacetValue(facetValueIdentifier, vid, fv, reqCtx));
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


}
