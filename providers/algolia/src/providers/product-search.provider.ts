import {
  type Cache,
  type FacetIdentifier,
  FacetIdentifierSchema,
  type FacetValueIdentifier,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductSearchProvider,
  type ProductSearchQueryByTerm,
  ProductSearchQueryByTermSchema,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  ProductSearchResultFacetSchema,
  type ProductSearchResultFacetValue,
  ProductSearchResultFacetValueSchema,
  type ProductSearchResultItem,
  type ProductSearchResultItemVariant,
  ProductSearchResultItemVariantSchema,
  ProductSearchResultSchema,
  Reactionary,
  type RequestContext
} from '@reactionary/core';
import { algoliasearch, type SearchResponse } from 'algoliasearch';
import type { AlgoliaConfiguration } from '../schema/configuration.schema.js';
import type { AlgoliaProductSearchResult } from '../schema/search.schema.js';

interface AlgoliaNativeVariant {
  sku: string;
  image: string;
}

interface AlgoliaNativeRecord {
  objectID: string;
  slug?:string;
  name?: string;
  variants: Array<AlgoliaNativeVariant>;
}


export class AlgoliaSearchProvider extends ProductSearchProvider {
  protected config: AlgoliaConfiguration;

  constructor(config: AlgoliaConfiguration, cache: Cache, context: RequestContext) {
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
    const result = this.parsePaginatedResult(input, payload) as AlgoliaProductSearchResult;

    for(const selectedFacet of payload.search.facets) {
      const facet = result.facets.find((f) => f.identifier.key === selectedFacet.facet.key);
      if(facet) {
          const value = facet.values.find((v) => v.identifier.key === selectedFacet.key);
          if(value) {
            value.active = true;
          }
        }
    }

    return result;
  }


  protected parseSingle(body: AlgoliaNativeRecord) {
    const product = {
      identifier: { key: body.objectID },
      name: body.name || body.objectID,
      slug: body.slug || body.objectID,
      variants: [ ... (body.variants || []) ].map(variant => this.parseVariant(variant, body)),
      meta: {
        placeholder: false,
        cache: {
          hit: false,
          key: ''
        }
      }
    } satisfies ProductSearchResultItem;

    return product;
  }

  protected override parseVariant(variant: AlgoliaNativeVariant, product: AlgoliaNativeRecord): ProductSearchResultItemVariant {
      const result = ProductSearchResultItemVariantSchema.parse({
      variant: {
        sku: variant.sku
      },
      image: ImageSchema.parse({
        sourceUrl: variant.image,
        altText: product.name || '',
      })
    } satisfies Partial<ProductSearchResultItemVariant>);

    return result;
  }

  protected parsePaginatedResult(body: SearchResponse<AlgoliaNativeRecord>, query: ProductSearchQueryByTerm) {
    const items = body.hits.map((hit) => this.parseSingle(hit));
    const facets: ProductSearchResultFacet[] = [];
    for (const id in body.facets) {
      const f = body.facets[id];
      const facetId = FacetIdentifierSchema.parse({
        key: id
      })
      const facet = this.parseFacet(facetId, f);
      facets.push(facet);
    }


    const result = {
      identifier: {
        term: query.search.term,
        facets: query.search.facets,
        filters: query.search.filters,
        paginationOptions: query.search.paginationOptions,

      },
      meta: {
        cache: { hit: false, key: 'unknown' },
        placeholder: false
      },
      pageNumber: (body.page || 0) + 1,
      pageSize: body.hitsPerPage || 0,
      totalCount: body.nbHits || 0,
      totalPages: body.nbPages || 0,
      items: items,
      facets,
    } satisfies ProductSearchResult;

    return result;
  }

  protected parseFacet(facetIdentifier: FacetIdentifier,  facetValues: Record<string, number>) : ProductSearchResultFacet {
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

      result.values.push(this.parseFacetValue(facetValueIdentifier, vid, fv));
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


}
