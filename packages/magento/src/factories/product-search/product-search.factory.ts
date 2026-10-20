import {
  FacetIdentifierSchema,
  FacetValueIdentifierSchema,
  ProductSearchResultFacetSchema,
  ProductSearchResultFacetValueSchema,
  ProductSearchResultItemComplianceDataSchema,
  type AnyProductSearchResultSchema,
  type FacetIdentifier,
  type FacetValueIdentifier,
  type ProductSearchFactory,
  type ProductSearchQueryByTerm,
  type ProductSearchResult,
  type ProductSearchResultFacet,
  type ProductSearchResultFacetValue,
  type ProductSearchResultItem,
  type ProductSearchResultItemComplianceData,
  type ProductSearchResultItemVariant,
  type ProductSearchResultSchema,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  MagentoAggregation,
  MagentoProductSearchDetails,
} from '../../schema/catalog.types.js';
import type { MagentoConfiguration } from '../../schema/configuration.schema.js';
import type { MagentoProduct, MagentoProductSearchResult } from '../../schema/magento.types.js';
import { MAGENTO_CATEGORY_FACET_KEY } from '../../utils/magento-category.js';
import {
  buildProductSearchResultItemVariant,
  canAddMagentoProductToCartDirectly,
  getCustomAttribute,
  getProductKey,
} from '../../utils/magento-product.js';

/** Aggregation codes Magento reports the category facet under (`category_uid` since 2.4.2). */
const CATEGORY_AGGREGATION_CODES = ['category_id', 'category_uid'];

export function isMagentoProductSearchDetails(
  data: MagentoProductSearchResult | MagentoProductSearchDetails,
): data is MagentoProductSearchDetails {
  return 'result' in data && typeof data.result === 'object' && data.result !== null;
}

/** `category_uid` values are base64-encoded entity ids. */
function decodeCategoryUid(uid: string): string {
  try {
    return atob(uid);
  } catch {
    return uid;
  }
}

export class MagentoProductSearchFactory<
  TProductSearchResultSchema extends AnyProductSearchResultSchema = typeof ProductSearchResultSchema,
> implements ProductSearchFactory<TProductSearchResultSchema>
{
  public readonly productSearchResultSchema: TProductSearchResultSchema;

  constructor(
    productSearchResultSchema: TProductSearchResultSchema,
    protected config: MagentoConfiguration,
  ) {
    this.productSearchResultSchema = productSearchResultSchema;
  }

  /**
   * Maps a search page. Accepts the bare REST result, or the
   * `MagentoProductSearchDetails` the capability assembles to add facets.
   */
  public parseSearchResult(
    context: RequestContext,
    data: MagentoProductSearchResult | MagentoProductSearchDetails,
    query: ProductSearchQueryByTerm,
  ): z.output<TProductSearchResultSchema> {
    const details: MagentoProductSearchDetails = isMagentoProductSearchDetails(data)
      ? data
      : { result: data };
    const pageSize = query.search.paginationOptions.pageSize;
    const currentPage = query.search.paginationOptions.pageNumber;

    const items: ProductSearchResultItem[] = (details.result.items || []).map((p) =>
      this.parseProductSearchResultItem(context, p),
    );

    const totalCount = details.result.total_count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    const facets: ProductSearchResultFacet[] = [];
    for (const aggregation of details.aggregations ?? []) {
      const facet = this.parseFacet(aggregation, query, details.categoryKeys ?? {});
      if (facet.values.length > 0) {
        facets.push(facet);
      }
    }

    const result = {
      identifier: {
        ...query.search,
      },
      pageNumber: currentPage,
      pageSize,
      totalCount,
      totalPages,
      items,
      facets,
    } satisfies ProductSearchResult;

    return this.productSearchResultSchema.parse(result);
  }

  /**
   * A GraphQL aggregation as a facet. The facet key is the attribute code and
   * the value key the option value (option id for select attributes), exactly
   * what the capability filters on. The category aggregation is reported
   * under the category navigation facet, keyed by category key.
   */
  protected parseFacet(
    aggregation: MagentoAggregation,
    query: ProductSearchQueryByTerm,
    categoryKeys: Record<string, string>,
  ): ProductSearchResultFacet {
    const isCategory = CATEGORY_AGGREGATION_CODES.includes(aggregation.attribute_code);
    const facetIdentifier = FacetIdentifierSchema.parse({
      key: isCategory ? MAGENTO_CATEGORY_FACET_KEY : aggregation.attribute_code,
    } satisfies FacetIdentifier);

    const values: ProductSearchResultFacetValue[] = [];
    for (const option of aggregation.options ?? []) {
      let valueKey = option.value;
      if (isCategory) {
        const id = aggregation.attribute_code === 'category_uid' ? decodeCategoryUid(option.value) : option.value;
        const key = categoryKeys[id];
        if (key === undefined) continue;
        valueKey = key;
      }

      const facetValueIdentifier = FacetValueIdentifierSchema.parse({
        facet: facetIdentifier,
        key: valueKey,
      } satisfies FacetValueIdentifier);

      const active =
        query.search.facets.some(
          (selected) => selected.facet.key === facetIdentifier.key && selected.key === valueKey,
        ) ||
        (isCategory && query.search.categoryFilter?.key === valueKey);

      values.push(
        this.parseFacetValue(facetValueIdentifier, option.label || valueKey, option.count ?? 0, active),
      );
    }

    return ProductSearchResultFacetSchema.parse({
      identifier: facetIdentifier,
      name: aggregation.label || aggregation.attribute_code,
      values,
    } satisfies ProductSearchResultFacet);
  }

  protected parseFacetValue(
    facetValueIdentifier: FacetValueIdentifier,
    label: string,
    count: number,
    active = false,
  ): ProductSearchResultFacetValue {
    return ProductSearchResultFacetValueSchema.parse({
      identifier: facetValueIdentifier,
      name: label,
      count,
      active,
    } satisfies ProductSearchResultFacetValue);
  }

  protected parseComplianceData(_product: MagentoProduct): ProductSearchResultItemComplianceData {
    return ProductSearchResultItemComplianceDataSchema.parse({});
  }

  /**
   * Items are keyed by `getProductKey` (external_id, falling back to the
   * entity id), like the product capability. Configurable, bundle and grouped
   * products cannot be added to the cart from a PLP.
   */
  protected parseProductSearchResultItem(
    _context: RequestContext,
    product: MagentoProduct,
  ): ProductSearchResultItem {
    const identifier = { key: getProductKey(product) };
    const slug =
      getCustomAttribute(product, 'url_key') ??
      getCustomAttribute(product, 'url_path') ??
      '';
    const name = product.name || product.sku;

    const variants: ProductSearchResultItemVariant[] = [];
    if (product.sku) {
      variants.push(this.parseVariant(product, product));
    }

    return {
      identifier,
      name,
      slug,
      canAddToCartDirectly: variants.length === 1 && canAddMagentoProductToCartDirectly(product),
      variants,
      complianceData: this.parseComplianceData(product),
    } satisfies ProductSearchResultItem;
  }

  protected parseVariant(
    variant: MagentoProduct,
    product: MagentoProduct,
  ): ProductSearchResultItemVariant {
    return buildProductSearchResultItemVariant(this.config, variant, product);
  }
}
