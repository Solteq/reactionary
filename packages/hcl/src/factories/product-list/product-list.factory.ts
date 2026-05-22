import type * as z from 'zod';
import type {
  AnyProductListItemPaginatedSchema,
  AnyProductListItemSchema,
  AnyProductListPaginatedSchema,
  AnyProductListSchema,
  ProductList,
  ProductListFactory,
  ProductListItem,
  ProductListIdentifier,
  ProductListItemPaginatedResult,
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListItemsQuery,
  ProductListPaginatedResult,
  ProductListPaginatedResultsSchema,
  ProductListQuery,
  ProductListSchema,
  ProductListType,
  RequestContext,
} from '@reactionary/core';
import type {
  HclRequisitionList,
  HclRequisitionListDetailResponse,
  HclRequisitionListItem,
  HclRequisitionListResponse,
  HclWishlist,
  HclWishlistItem,
  HclWishlistItemResponse,
  HclWishlistListResponse,
} from '../../schema/hcl.schema.js';

/** Passed to parseProductListItem so it can include the parent list reference. */
export interface HclProductListItemInput {
  item: HclWishlistItem;
  list: ProductListIdentifier;
}

/** Passed to parseRequisitionListItem so it can include the parent list reference. */
export interface HclRequisitionListItemInput {
  item: HclRequisitionListItem;
  list: ProductListIdentifier;
}

/** Extension interface implemented by HclProductListFactory for requisition list parsing. */
export interface HclRequisitionListFactoryExtension {
  parseRequisitionList(
    context: RequestContext,
    data: HclRequisitionList,
  ): unknown;
  parseRequisitionListItem(
    context: RequestContext,
    data: HclRequisitionListItemInput,
  ): unknown;
  parseRequisitionListPaginatedResult(
    context: RequestContext,
    data: HclRequisitionListResponse,
    query: ProductListQuery,
  ): unknown;
  parseRequisitionListItemPaginatedResult(
    context: RequestContext,
    data: HclRequisitionListDetailResponse,
    query: ProductListItemsQuery,
  ): unknown;
}

/**
 * Wishlist types that map to the /wishlist WCS API.
 * Requisition lists use their own API and are excluded here.
 */
const WISHLIST_TYPES = new Set<string>(['favorite', 'wish', 'shopping']);

/**
 * Encode a listType and user description into HCL's description field.
 * Format: `{type}:{description}` — e.g. `favorite:My list` or `wish:`
 */
export function encodeWishlistType(
  type: string,
  description: string | undefined,
): string {
  return `${type}:${description ?? ''}`;
}

/**
 * Decode listType and user description from HCL's description field.
 * Falls back to `wish` for lists that pre-date the encoding scheme.
 */
function decodeWishlistType(raw: string | undefined): {
  type: ProductListType;
  description: string | undefined;
} {
  if (raw) {
    const colonIdx = raw.indexOf(':');
    if (colonIdx > 0) {
      const prefix = raw.slice(0, colonIdx);
      if (WISHLIST_TYPES.has(prefix)) {
        const desc = raw.slice(colonIdx + 1);
        return { type: prefix as ProductListType, description: desc || undefined };
      }
    }
  }
  return { type: 'wish', description: raw || undefined };
}

export class HclProductListFactory<
  TProductListSchema extends AnyProductListSchema = typeof ProductListSchema,
  TProductListItemSchema extends
    AnyProductListItemSchema = typeof ProductListItemSchema,
  TProductListPaginatedSchema extends
    AnyProductListPaginatedSchema = typeof ProductListPaginatedResultsSchema,
  TProductListItemPaginatedSchema extends
    AnyProductListItemPaginatedSchema = typeof ProductListItemPaginatedResultsSchema,
> implements
    ProductListFactory<
      TProductListSchema,
      TProductListItemSchema,
      TProductListPaginatedSchema,
      TProductListItemPaginatedSchema
    >
{
  public readonly productListSchema: TProductListSchema;
  public readonly productListItemSchema: TProductListItemSchema;
  public readonly productListPaginatedSchema: TProductListPaginatedSchema;
  public readonly productListItemPaginatedSchema: TProductListItemPaginatedSchema;

  constructor(
    productListSchema: TProductListSchema,
    productListItemSchema: TProductListItemSchema,
    productListPaginatedSchema: TProductListPaginatedSchema,
    productListItemPaginatedSchema: TProductListItemPaginatedSchema,
  ) {
    this.productListSchema = productListSchema;
    this.productListItemSchema = productListItemSchema;
    this.productListPaginatedSchema = productListPaginatedSchema;
    this.productListItemPaginatedSchema = productListItemPaginatedSchema;
  }

  public parseProductList(
    _context: RequestContext,
    data: HclWishlist,
  ): z.output<TProductListSchema> {
    const key = data.uniqueID ?? data.externalIdentifier ?? '';
    const { type, description } = decodeWishlistType(data.description);

    const result = {
      identifier: { key, listType: type },
      type,
      name: data.descriptionName ?? '',
      description,
      published: true,
    } satisfies ProductList;

    return this.productListSchema.parse(result);
  }

  public parseProductListItem(
    _context: RequestContext,
    data: HclProductListItemInput,
  ): z.output<TProductListItemSchema> {
    const result = {
      identifier: { key: data.item.giftListItemID ?? '', list: data.list },
      variant: { sku: data.item.productId ?? data.item.partNumber ?? '' },
      quantity: Math.max(1, Number(data.item.quantityRequested ?? 1)),
      order: 1,
    } satisfies ProductListItem;

    return this.productListItemSchema.parse(result);
  }

  public parseProductListPaginatedResult(
    context: RequestContext,
    data: HclWishlistListResponse,
    query: ProductListQuery,
  ): z.output<TProductListPaginatedSchema> {
    // Parse all lists then filter client-side — HCL returns all wishlists
    // regardless of type; the type is stored in the encoded description field.
    const items = (data.GiftList ?? [])
      .map((w) => this.parseProductList(context, w))
      .filter((item) => (item as ProductList).identifier.listType === query.search.listType);

    const result = {
      identifier: {
        listType: query.search.listType,
        paginationOptions: query.search.paginationOptions,
      },
      items,
      totalCount: items.length,
      pageSize: Math.max(1, items.length),
      pageNumber: 1,
      totalPages: 1,
    } satisfies ProductListPaginatedResult;

    return this.productListPaginatedSchema.parse(result);
  }

  public parseProductListItemPaginatedResult(
    context: RequestContext,
    data: HclWishlistItemResponse,
    query: ProductListItemsQuery,
  ): z.output<TProductListItemPaginatedSchema> {
    const rawItems = data.GiftList?.[0]?.item ?? [];
    const items = rawItems.map((i) =>
      this.parseProductListItem(context, { item: i, list: query.search.list }),
    );

    const result = {
      identifier: {
        list: query.search.list,
        paginationOptions: query.search.paginationOptions,
      },
      items,
      totalCount: Number(data.recordSetTotal ?? items.length),
      pageSize: items.length,
      pageNumber: 1,
      totalPages: 1,
    } satisfies ProductListItemPaginatedResult;

    return this.productListItemPaginatedSchema.parse(result);
  }

  // ---------------------------------------------------------------------------
  // Requisition list parsers
  // ---------------------------------------------------------------------------

  public parseRequisitionList(
    _context: RequestContext,
    data: HclRequisitionList,
  ): z.output<TProductListSchema> {
    const result = {
      identifier: {
        key: data.requisitionListId ?? '',
        listType: 'requisition' as const,
      },
      type: 'requisition' as const,
      name: data.name ?? '',
      description: data.description,
      published: true,
    } satisfies ProductList;

    return this.productListSchema.parse(result);
  }

  public parseRequisitionListItem(
    _context: RequestContext,
    data: HclRequisitionListItemInput,
  ): z.output<TProductListItemSchema> {
    const result = {
      identifier: {
        key: data.item.requisitionListItemId ?? '',
        list: data.list,
      },
      variant: { sku: data.item.productId ?? data.item.partNumber ?? '' },
      quantity: Math.max(1, Number(data.item.quantity ?? 1)),
      order: 1,
    } satisfies ProductListItem;

    return this.productListItemSchema.parse(result);
  }

  public parseRequisitionListPaginatedResult(
    context: RequestContext,
    data: HclRequisitionListResponse,
    query: ProductListQuery,
  ): z.output<TProductListPaginatedSchema> {
    const items = (data.resultList ?? []).map((r) =>
      this.parseRequisitionList(context, r),
    );

    const result = {
      identifier: {
        listType: query.search.listType,
        paginationOptions: query.search.paginationOptions,
      },
      items,
      totalCount: Number(data.recordSetTotal ?? items.length),
      pageSize: Math.max(1, items.length),
      pageNumber: 1,
      totalPages: 1,
    } satisfies ProductListPaginatedResult;

    return this.productListPaginatedSchema.parse(result);
  }

  public parseRequisitionListItemPaginatedResult(
    context: RequestContext,
    data: HclRequisitionListDetailResponse,
    query: ProductListItemsQuery,
  ): z.output<TProductListItemPaginatedSchema> {
    const rawItems = data.resultList?.[0]?.item ?? [];
    const items = rawItems.map((i) =>
      this.parseRequisitionListItem(context, {
        item: i,
        list: query.search.list,
      }),
    );

    const result = {
      identifier: {
        list: query.search.list,
        paginationOptions: query.search.paginationOptions,
      },
      items,
      totalCount: Number(data.recordSetTotal ?? items.length),
      pageSize: Math.max(1, items.length),
      pageNumber: 1,
      totalPages: 1,
    } satisfies ProductListItemPaginatedResult;

    return this.productListItemPaginatedSchema.parse(result);
  }
}
