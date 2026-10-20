import type {
  AnyProductListItemPaginatedSchema,
  AnyProductListItemSchema,
  AnyProductListPaginatedSchema,
  AnyProductListSchema,
  ProductList,
  ProductListFactory,
  ProductListIdentifier,
  ProductListItem,
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListItemsQuery,
  ProductListPaginatedResultsSchema,
  ProductListQuery,
  ProductListSchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type {
  MagentoProductListItemPage,
  MagentoProductListItemSource,
  MagentoProductListPage,
  MagentoProductListSource,
} from '../../schema/product-list.types.js';

/**
 * Maps Magento wishlists (`wish` / `favorite`) and Adobe Commerce B2B
 * requisition lists (`requisition`) onto core product lists.
 *
 * Field notes:
 * - wishlist `visibility` PUBLIC/PRIVATE ↔ `published`; requisition lists have
 *   no visibility and are always reported unpublished;
 * - Magento has no list image or publish date;
 * - wishlist item `description` ↔ `notes`; requisition items have no notes;
 * - Magento keeps no per-item order, so `order` is the item's 1-based position.
 */
export class MagentoProductListFactory<
  TProductListSchema extends AnyProductListSchema = typeof ProductListSchema,
  TProductListItemSchema extends AnyProductListItemSchema = typeof ProductListItemSchema,
  TProductListPaginatedSchema extends AnyProductListPaginatedSchema = typeof ProductListPaginatedResultsSchema,
  TProductListItemPaginatedSchema extends AnyProductListItemPaginatedSchema = typeof ProductListItemPaginatedResultsSchema,
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

  /** The core list identifier for a Magento list. */
  public parseListIdentifier(data: MagentoProductListSource): ProductListIdentifier {
    const user = data.userId ? { userId: data.userId } : undefined;
    if (data.kind === 'wishlist') {
      return { listType: data.listType, key: data.wishlist.id, user };
    }
    return { listType: 'requisition', key: data.requisitionList.uid, user };
  }

  public parseProductList(
    _context: RequestContext,
    data: MagentoProductListSource,
  ): z.output<TProductListSchema> {
    const identifier = this.parseListIdentifier(data);

    let result: ProductList;
    if (data.kind === 'wishlist') {
      result = {
        identifier,
        type: data.listType,
        // Open Source wishlists have no name; Adobe Commerce always sets one.
        name: data.wishlist.name || 'Wish List',
        published: data.wishlist.visibility === 'PUBLIC',
      };
    } else {
      result = {
        identifier,
        type: 'requisition',
        name: data.requisitionList.name,
        description: data.requisitionList.description || undefined,
        published: false,
      };
    }

    return this.productListSchema.parse(result);
  }

  public parseProductListItem(
    _context: RequestContext,
    data: MagentoProductListItemSource,
  ): z.output<TProductListItemSchema> {
    let result: ProductListItem;
    if (data.kind === 'wishlist') {
      result = {
        identifier: { key: data.item.id, list: data.list },
        variant: {
          sku: data.item.configured_variant?.sku || data.item.product?.sku || '',
        },
        quantity: data.item.quantity,
        notes: data.item.description || undefined,
        order: data.position,
      };
    } else {
      result = {
        identifier: { key: data.item.uid, list: data.list },
        variant: { sku: data.item.product?.sku || '' },
        quantity: data.item.quantity,
        order: data.position,
      };
    }

    return this.productListItemSchema.parse(result);
  }

  public parseProductListPaginatedResult(
    context: RequestContext,
    data: MagentoProductListPage,
    query: ProductListQuery,
  ): z.output<TProductListPaginatedSchema> {
    const { pageNumber, pageSize } = query.search.paginationOptions;
    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: data.totalCount,
      totalPages: Math.ceil(data.totalCount / pageSize),
      items: data.lists.map((list) => this.parseProductList(context, list)),
    };

    return this.productListPaginatedSchema.parse(result);
  }

  public parseProductListItemPaginatedResult(
    context: RequestContext,
    data: MagentoProductListItemPage,
    query: ProductListItemsQuery,
  ): z.output<TProductListItemPaginatedSchema> {
    const { pageNumber, pageSize } = query.search.paginationOptions;
    const result = {
      identifier: query.search,
      pageNumber,
      pageSize,
      totalCount: data.totalCount,
      totalPages: Math.ceil(data.totalCount / pageSize),
      items: data.items.map((item) => this.parseProductListItem(context, item)),
    };

    return this.productListItemPaginatedSchema.parse(result);
  }
}
