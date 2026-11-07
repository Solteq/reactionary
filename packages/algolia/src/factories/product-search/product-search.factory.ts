import type {
  AnyProductSearchResultSchema,
  FacetIdentifier,
  FacetValueIdentifier,
  ProductSearchFactory,
  ProductSearchQueryByTerm,
  ProductSearchResultAttributeFacet,
  ProductSearchResultAvailabilityFacet,
  ProductSearchResultFacet,
  ProductSearchResultFacetValue,
  ProductSearchResultItem,
  ProductSearchResultItemComplianceData,
  ProductSearchResultItemVariant,
  ProductSearchResultPriceFacet,
  ProductSearchResultRatingFacet,
  ProductSearchResultTaxonomyFacet,
  RequestContext,
  SearchFacetPolicy,
  SearchFacetPolicyOptions,
} from '@reactionary/core';
import {
  createSearchFacetPolicy,
  fromMinorUnits,
  getTaxonomyFacetName,
  getVocabularyName,
  isHiddenSearchFacet,
  orderSearchFacets,
  parseSearchDocumentTaxonomy,
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ImageSchema,
  ProductSearchResultAttributeFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemComplianceDataSchema,
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
import { markSelectedFacets } from '../../core/facet-selection.js';

export class AlgoliaProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = typeof AlgoliaProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;
  protected readonly facetPolicy: SearchFacetPolicy;

  /**
   * @param facets which facets to hide, order, name and make multiselect, and which index fields stand behind price, rating, availability and taxonomy
   */
  constructor(productSearchResultSchema: TProductSearchResultSchema, facets?: SearchFacetPolicyOptions) {
    this.productSearchResultSchema = productSearchResultSchema;
    this.facetPolicy = createSearchFacetPolicy(facets);
  }

  public parseSearchResult(
    context: RequestContext,
    data: unknown,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    const body = this.parseInput(data);
    const items = body.hits.map((hit) => this.parseSingle(hit));
    const fields = this.facetPolicy.fields;
    const typedFields = [fields.priceMin, fields.priceMax, fields.rating, fields.online, fields.stores];

    let attributeFacets: ProductSearchResultAttributeFacet[] = [];
    const taxonomyFacets: ProductSearchResultTaxonomyFacet[] = [];
    for (const id in body.facets) {
      const values = body.facets[id];
      if (id.startsWith(fields.conceptFacetPrefix)) {
        const taxonomy = this.parseTaxonomyFacet(id.slice(fields.conceptFacetPrefix.length), values);
        if (taxonomy.values.length > 0) {
          taxonomyFacets.push(taxonomy);
        }
        continue;
      }
      // the fields behind price, rating and availability become typed facets below, and are never attributes
      if (typedFields.includes(id) || isHiddenSearchFacet(id, this.facetPolicy)) {
        continue;
      }
      const facetId = FacetIdentifierSchema.parse({ key: id });
      const facet = this.parseFacet(facetId, values);
      const stats = body.facets_stats?.[id];
      if (stats?.min !== undefined && stats.max !== undefined) {
        facet.stats = { min: stats.min, max: stats.max };
      }
      if (facet.values.length > 0) {
        attributeFacets.push(facet);
      }
    }

    const selectedCategoryFacet =
      query.search.facets.find((x) => x.facet.key === 'categories') ||
      query.search.categoryFilter;

    let subCategoryFacet;
    if (selectedCategoryFacet) {
      const valueDepth = selectedCategoryFacet.key.split(' > ').length;
      subCategoryFacet = attributeFacets.find(
        (f) => f.identifier.key === `hierarchy.lvl${valueDepth}`,
      );
    } else {
      subCategoryFacet = attributeFacets.find((f) => f.identifier.key === 'hierarchy.lvl0');
    }

    if (subCategoryFacet) {
      subCategoryFacet.identifier = FacetIdentifierSchema.parse({ key: 'categories' });
      subCategoryFacet.name = 'Categories';
      subCategoryFacet.multiselect = false;
      for (const value of subCategoryFacet.values) {
        const pathParts = value.identifier.key.split(' > ');
        value.identifier.facet = subCategoryFacet.identifier;
        value.name = pathParts[pathParts.length - 1];
      }
    }

    attributeFacets = attributeFacets.filter((f) => !f.identifier.key.startsWith('hierarchy.lvl'));

    const facets: ProductSearchResultFacet[] = [...attributeFacets, ...taxonomyFacets];
    for (const typed of [
      this.parsePriceFacet(context, body),
      this.parseRatingFacet(body.facets?.[fields.rating]),
      this.parseAvailabilityFacet(body.facets?.[fields.online], body.facets?.[fields.stores]),
    ]) {
      if (typed) {
        facets.push(typed);
      }
    }
    markSelectedFacets(facets, query.search);

    const result = {
      identifier: {
        term: query.search.term,
        facets: query.search.facets,
        ...(query.search.conceptContext ? { conceptContext: query.search.conceptContext } : {}),
        ...(query.search.conceptFilter ? { conceptFilter: query.search.conceptFilter } : {}),
        ...(query.search.priceFilter ? { priceFilter: query.search.priceFilter } : {}),
        ...(query.search.ratingFilter ? { ratingFilter: query.search.ratingFilter } : {}),
        ...(query.search.availabilityFilter ? { availabilityFilter: query.search.availabilityFilter } : {}),
        ...(query.search.ranges ? { ranges: query.search.ranges } : {}),
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
      facets: orderSearchFacets(facets, this.facetPolicy),
    } satisfies AlgoliaProductSearchResult;

    return this.productSearchResultSchema.parse(result);
  }

  protected parseComplianceData(data: AlgoliaNativeRecord): ProductSearchResultItemComplianceData {
    return data.complianceData  ?? ProductSearchResultItemComplianceDataSchema.parse({});
  }

  protected parseSingle(body: AlgoliaNativeRecord): ProductSearchResultItem {
    const variants = [...(body.variants || [])].map((variant) =>
      this.parseVariant(variant, body),
    );
    return {
      identifier: { key: body.objectID },
      name: body.name || body.objectID,
      slug: body.slug || body.objectID,
      complianceData: this.parseComplianceData(body),
      ...parseSearchDocumentTaxonomy(body),
      canAddToCartDirectly: body.canAddToCartDirectly ?? variants.length === 1,
      variants,
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
  ): ProductSearchResultAttributeFacet {
    const result = ProductSearchResultAttributeFacetSchema.parse({
      semantic: 'attribute',
      identifier: facetIdentifier,
      name: getTaxonomyFacetName(facetIdentifier.key, this.facetPolicy) ?? facetIdentifier.key,
      multiselect: facetIdentifier.key !== 'categories' && this.facetPolicy.multiselect.includes(facetIdentifier.key),
      values: [],
    } satisfies Partial<ProductSearchResultAttributeFacet>);

    // never return the categories facet raw, as its only used for navigation and should be remapped to the hierarchy facet
    if (facetIdentifier.key === 'categories') {
      return result;
    }

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

  /** The name of a typed facet: the policy wins, looked up by "taxonomy:<vocabulary>", "price", "rating" or "availability". */
  protected getTypedFacetName(id: string, fallback: string): string {
    return this.facetPolicy.names[id] ?? fallback;
  }

  /**
   * The concepts of one vocabulary. The engine counts values written as "<concept id>|<localized name>", split on the first "|". A value
   * without one is the concept id, named after the last part of it.
   */
  protected parseTaxonomyFacet(vocabulary: string, facetValues: Record<string, number>): ProductSearchResultTaxonomyFacet {
    const indexKey = `${this.facetPolicy.fields.conceptFacetPrefix}${vocabulary}`;
    return {
      semantic: 'taxonomy',
      vocabulary,
      name: this.getTypedFacetName(`taxonomy:${vocabulary}`, this.facetPolicy.names[indexKey] ?? getVocabularyName(vocabulary)),
      multiselect: true,
      values: Object.entries(facetValues).map(([raw, count]) => {
        const separator = raw.indexOf('|');
        const id = separator >= 0 ? raw.slice(0, separator) : raw;
        const name = separator >= 0 ? raw.slice(separator + 1) : '';
        return { concept: { key: id }, name: name || id.split('/').pop() || id, count, active: false };
      }),
    };
  }

  /** The price, from the stats of the minor-unit fields: the lowest of the lowest prices, and the highest of the highest. */
  protected parsePriceFacet(
    context: RequestContext,
    body: SearchResponse<AlgoliaNativeRecord>,
  ): ProductSearchResultPriceFacet | undefined {
    const { priceMin, priceMax } = this.facetPolicy.fields;
    const min = body.facets_stats?.[priceMin]?.min;
    const max = body.facets_stats?.[priceMax]?.max;
    if (min === undefined || max === undefined) {
      return undefined;
    }
    const currency = context.languageContext.currencyCode;
    return {
      semantic: 'price',
      name: this.getTypedFacetName('price', 'Price'),
      multiselect: false,
      currency,
      stats: { min: fromMinorUnits(min, currency), max: fromMinorUnits(max, currency) },
    };
  }

  /** One bucket per whole star, the best first. */
  protected parseRatingFacet(facetValues: Record<string, number> | undefined): ProductSearchResultRatingFacet | undefined {
    const buckets = Object.entries(facetValues ?? {})
      .map(([star, count]) => ({ star: Number(star), count }))
      .filter((x) => Number.isFinite(x.star))
      .sort((a, b) => b.star - a.star)
      .map(({ star, count }) => ({ min: star, max: star, count, active: false }));
    if (buckets.length === 0) {
      return undefined;
    }
    return { semantic: 'rating', name: this.getTypedFacetName('rating', 'Rating'), multiselect: false, buckets };
  }

  /** Online when some product has the online flag, and the stores the products are in stock in. */
  protected parseAvailabilityFacet(
    online: Record<string, number> | undefined,
    stores: Record<string, number> | undefined,
  ): ProductSearchResultAvailabilityFacet | undefined {
    const onlineCount = online?.['true'];
    const storeList = Object.entries(stores ?? {}).map(([key, count]) => ({ store: { key }, count, active: false }));
    if (onlineCount === undefined && storeList.length === 0) {
      return undefined;
    }
    return {
      semantic: 'availability',
      name: this.getTypedFacetName('availability', 'Availability'),
      multiselect: true,
      ...(onlineCount !== undefined ? { online: { count: onlineCount, active: false } } : {}),
      stores: storeList,
    };
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
