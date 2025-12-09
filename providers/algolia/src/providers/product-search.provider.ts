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
  type ProductSearchQueryCreateNavigationFilter,
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
  type RequestContext,
  type Result,
  success
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
  ): Promise<Result<ProductSearchResult>> {
    const client = algoliasearch(this.config.appId, this.config.apiKey);

    const facetsThatAreNotCategory = payload.search.facets.filter(x => x.facet.key !== 'categories');
    const categoryFacet = payload.search.facets.find(x => x.facet.key === 'categories') || payload.search.categoryFilter;

    const finalFilters = [...payload.search.filters || []];


    const finalFacetFilters = [
      ...facetsThatAreNotCategory.map(
        (x) => `${x.facet.key}:${x.key}`
      ),
    ]
    if (categoryFacet) {
      finalFilters.push(`categories:"${categoryFacet.key}"`);
    }


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
          facetFilters: finalFacetFilters,
          filters: (finalFilters || [])
            .join(' AND '),
        },
      ],
    });

    const input = remote.results[0] as SearchResponse<AlgoliaNativeRecord>;
    const result = this.parsePaginatedResult(input, payload) as AlgoliaProductSearchResult;

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

    return success(result);
  }

  public override async createCategoryNavigationFilter(payload: ProductSearchQueryCreateNavigationFilter): Promise<Result<FacetValueIdentifier>> {

    const facetIdentifier = FacetIdentifierSchema.parse({
      key: 'categories'
    });
    const facetValueIdentifier = FacetValueIdentifierSchema.parse({
      facet: facetIdentifier,
      key: payload.categoryPath.map(c => c.name).join(' > ')
    });
    return success(facetValueIdentifier);
  }


  protected parseSingle(body: AlgoliaNativeRecord) {
    const product = {
      identifier: { key: body.objectID },
      name: body.name || body.objectID,
      slug: body.slug || body.objectID,
      variants: [ ... (body.variants || []) ].map(variant => this.parseVariant(variant, body)),
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
    let facets: ProductSearchResultFacet[] = [];
    for (const id in body.facets) {
      const f = body.facets[id];
      const facetId = FacetIdentifierSchema.parse({
        key: id
      })
      const facet = this.parseFacet(facetId, f);
      facets.push(facet);
    }


    // we do something to convert the hierachy.lvl.n facet values into something more usable
    const selectedCategoryFacet = query.search.facets.find(x => x.facet.key === 'categories') || query.search.categoryFilter;
    let subCategoryFacet;
    if(selectedCategoryFacet) {
      const valueDepth = selectedCategoryFacet.key.split(' > ').length;
      // ok, so input defined a facet value from level X, we return hierarchy.lvl.(X+1) as subcategories.
      // hierarchy counts from 0, so length is already pointing to 'lvl.(X+1)'
      subCategoryFacet = facets.find(f => f.identifier.key === `hierarchy.lvl${valueDepth}`);
    } else {
      // and remap lvl0 to 'categories'
      subCategoryFacet = facets.find(f => f.identifier.key === 'hierarchy.lvl0');
    }

    if(subCategoryFacet) {
      // remap to 'categories' facet
      subCategoryFacet.identifier = FacetIdentifierSchema.parse({
        key: 'categories'
      });
      subCategoryFacet.name = 'Categories';
      for(const v of subCategoryFacet.values) {
        const pathParts = v.identifier.key.split(' > ');
        v.identifier.facet = subCategoryFacet.identifier;
        v.name = pathParts[pathParts.length -1];
      }
    }

    // remove other hierarchy facets
    facets = facets.filter(f => !f.identifier.key.startsWith('hierarchy.lvl'));



    const result = {
      identifier: {
        term: query.search.term,
        facets: query.search.facets,
        filters: query.search.filters,
        paginationOptions: query.search.paginationOptions,

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
