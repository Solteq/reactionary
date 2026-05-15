import type {
  AnyProductSearchResultSchema,
  FacetIdentifier,
  FacetValueIdentifier,
  ProductSearchFactory,
  ProductSearchResult,
  ProductSearchResultFacet,
  ProductSearchResultFacetValue,
  ProductSearchResultItem,
  ProductSearchResultItemVariant,
  RequestContext,
  ProductSearchQueryByTerm,
} from '@reactionary/core';
import type * as z from 'zod';
import type { ProductSearchResultSchema } from '@reactionary/core';
import type {
  HclFacet,
  HclProductQueryResponse,
  HclProductSearchItem,
} from '../../schema/hcl.schema.js';

export class HclProductSearchFactory<
  TProductSearchResultSchema extends
    AnyProductSearchResultSchema = typeof ProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(productSearchResultSchema: TProductSearchResultSchema) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  public parseSearchResult(
    _context: RequestContext,
    data: HclProductQueryResponse,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    const rawItems = data.contents ?? data.catalogEntryView ?? [];
    const { pageNumber, pageSize } = query.search.paginationOptions;
    const totalCount = data.total ?? data.recordSetTotal ?? rawItems.length;

    const items: ProductSearchResultItem[] = rawItems.map((p) =>
      this.parseSearchItem(p),
    );

    const facets: ProductSearchResultFacet[] = (data.facets ?? []).map((f) =>
      this.parseFacet(f, query),
    );

    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      items,
      facets,
    } satisfies ProductSearchResult;

    return this.productSearchResultSchema.parse(result);
  }

  protected parseSearchItem(p: HclProductSearchItem): ProductSearchResultItem {
    const slug =
      p.seo?.href?.split('/').filter(Boolean).pop() ??
      p.seo?.tokenValue ??
      p.partNumber;

    // Search profile responses don't include nested items[]/SKUs — represent
    // the product itself as the single purchasable variant.
    const variants: ProductSearchResultItemVariant[] = [
      {
        variant: { sku: p.partNumber },
        image: {
          sourceUrl: p.fullImage || p.thumbnail || '',
          altText: p.name,
          width: 0,
          height: 0,
        },
      },
    ];

    return {
      identifier: { key: p.partNumber },
      name: p.name ?? '',
      slug,
      variants,
    } satisfies ProductSearchResultItem;
  }

  protected parseFacet(
    f: HclFacet,
    query: ProductSearchQueryByTerm,
  ): ProductSearchResultFacet {
    const facetId: FacetIdentifier = { key: f.value };

    const values: ProductSearchResultFacetValue[] = (f.entry ?? []).map(
      (entry) => {
        const isActive = query.search.facets.some(
          (sel: FacetValueIdentifier) =>
            sel.facet.key === f.value && sel.key === entry.value,
        );
        return {
          identifier: { facet: facetId, key: entry.value },
          name: entry.label || entry.name || entry.value,
          count: Number(entry.count) || 0,
          active: isActive,
        } satisfies ProductSearchResultFacetValue;
      },
    );

    return {
      identifier: facetId,
      name: f.name || f.value,
      values,
    } satisfies ProductSearchResultFacet;
  }
}
