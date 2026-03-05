import type {
  AnyProductSearchResultSchema,
  FacetIdentifier,
  FacetValueIdentifier,
  ProductSearchFactory,
  ProductSearchQueryByTerm,
  ProductSearchResultFacet,
  ProductSearchResultFacetValue,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  RequestContext,
} from '@reactionary/core';
import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemVariantSchema,
} from '@reactionary/core';
import type * as z from 'zod';
import type { SearchResponse } from 'algoliasearch';
import type {
  AlgoliaNativeRecord,
  AlgoliaNativeVariant,
  AlgoliaProductSearchResult,
} from '../../schema/search.schema.js';
import type { AlgoliaProductSearchResultSchema } from '../../schema/search.schema.js';

export class AlgoliaProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = typeof AlgoliaProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(productSearchResultSchema: TProductSearchResultSchema) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  public parseSearchResult(
    _context: RequestContext,
    data: unknown,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    const body = this.parseInput(data);
    const items = body.hits.map((hit) => this.parseSingle(hit));

    let facets: ProductSearchResultFacet[] = [];
    for (const id in body.facets) {
      const values = body.facets[id];
      const facetId = FacetIdentifierSchema.parse({ key: id });
      facets.push(this.parseFacet(facetId, values));
    }

    const selectedCategoryFacet =
      query.search.facets.find((x) => x.facet.key === 'categories') ||
      query.search.categoryFilter;

    let subCategoryFacet;
    if (selectedCategoryFacet) {
      const valueDepth = selectedCategoryFacet.key.split(' > ').length;
      subCategoryFacet = facets.find(
        (f) => f.identifier.key === `hierarchy.lvl${valueDepth}`,
      );
    } else {
      subCategoryFacet = facets.find((f) => f.identifier.key === 'hierarchy.lvl0');
    }

    if (subCategoryFacet) {
      subCategoryFacet.identifier = FacetIdentifierSchema.parse({ key: 'categories' });
      subCategoryFacet.name = 'Categories';
      for (const value of subCategoryFacet.values) {
        const pathParts = value.identifier.key.split(' > ');
        value.identifier.facet = subCategoryFacet.identifier;
        value.name = pathParts[pathParts.length - 1];
      }
    }

    facets = facets.filter((f) => !f.identifier.key.startsWith('hierarchy.lvl'));

    const result = {
      identifier: {
        term: query.search.term,
        facets: query.search.facets,
        filters: query.search.filters,
        paginationOptions: query.search.paginationOptions,
        index: body.index || '',
        key: body.queryID || '',
      },
      pageNumber: (body.page || 0) + 1,
      pageSize: body.hitsPerPage || 0,
      totalCount: body.nbHits || 0,
      totalPages: body.nbPages || 0,
      items,
      facets,
    } satisfies AlgoliaProductSearchResult;

    return this.productSearchResultSchema.parse(result);
  }

  protected parseSingle(body: AlgoliaNativeRecord): ProductSearchResultItem {
    return {
      identifier: { key: body.objectID },
      name: body.name || body.objectID,
      slug: body.slug || body.objectID,
      variants: [...(body.variants || [])].map((variant) =>
        this.parseVariant(variant, body),
      ),
    } satisfies ProductSearchResultItem;
  }

  protected parseVariant(
    variant: AlgoliaNativeVariant,
    product: AlgoliaNativeRecord,
  ): ProductSearchResultItemVariant {
    return ProductSearchResultItemVariantSchema.parse({
      variant: {
        sku: variant.sku,
      },
      image: ImageSchema.parse({
        sourceUrl: variant.image,
        altText: product.name || '',
      }),
    } satisfies Partial<ProductSearchResultItemVariant>);
  }

  protected parseFacet(
    facetIdentifier: FacetIdentifier,
    facetValues: Record<string, number>,
  ): ProductSearchResultFacet {
    const result = ProductSearchResultFacetSchema.parse({
      identifier: facetIdentifier,
      name: facetIdentifier.key,
      values: [],
    } satisfies Partial<ProductSearchResultFacet>);

    for (const valueId in facetValues) {
      const count = facetValues[valueId];
      const facetValueIdentifier = FacetValueIdentifierSchema.parse({
        facet: facetIdentifier,
        key: valueId,
      } satisfies Partial<FacetValueIdentifier>);

      result.values.push(this.parseFacetValue(facetValueIdentifier, valueId, count));
    }

    return result;
  }

  protected parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number,
  ): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count,
      active: false,
    } satisfies Partial<ProductSearchResultFacetValue>);
  }

  protected parseInput(data: unknown): SearchResponse<AlgoliaNativeRecord> {
    if (!this.isSearchResponse(data)) {
      throw new Error('Invalid Algolia search response');
    }

    return data;
  }

  protected isSearchResponse(data: unknown): data is SearchResponse<AlgoliaNativeRecord> {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (!('hits' in data) || !Array.isArray(data.hits)) {
      return false;
    }

    return true;
  }
}
