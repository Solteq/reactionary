import type { ShoppingList, ShoppingListLineItem, ShoppingListPagedQueryResponse } from '@commercetools/platform-sdk';
import type {
  IdentityIdentifier,
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListItemsQuery,
  ProductListPaginatedResultsSchema,
  ProductListQuery,
  ProductListSchema} from '@reactionary/core';
import {
  type AnyProductListItemPaginatedSchema,
  type AnyProductListItemSchema,
  type AnyProductListPaginatedSchema,
  type AnyProductListSchema,
  type ProductList,
  type ProductListFactory,
  type ProductListIdentifier,
  type ProductListItem,
  type ProductListItemPaginatedResult,
  type ProductListPaginatedResult,
  type ProductListType,
  type RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';
import type { CommercetoolsProductListIdentifier } from '../../schema/commercetools.schema.js';

export interface CommercetoolsProductListItemFactoryInput {
  listIdentifier: ProductListIdentifier;
  lineItem: ShoppingListLineItem;
}


export class CommercetoolsProductListFactory<
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

  /**
   * This is a customer owned resource, so we just use english as otherwise it will fail if he changes the visual language settings.
   * @returns
   */
  protected getLocaleString(): string {
    return 'en';
  }
  public parseProductList(
    _context: RequestContext,
    data: ShoppingList,
  ): z.output<TProductListSchema> {

    const localeString = this.getLocaleString();


    const listType = data.custom?.fields['listType'] as ProductListType || 'favorite';
    const image = data.custom?.fields['imageUrl'] as string | undefined;
    const published = data.custom?.fields['published'] as boolean && true;
    const publishDateDate = data.custom?.fields['publishedDate'] as string | undefined;
    let publishedDate: string | undefined;
    if (publishDateDate) {
      publishedDate = new Date(publishDateDate).toISOString();
    }

    const result = {
      identifier: {
        listType: listType as ProductListType,
        key: data.id,
        user: data.customer ? {
          userId: data.customer.id
        } as IdentityIdentifier : undefined,
        version: Number(data.version),
        company: data.businessUnit ? { taxIdentifier: data.businessUnit.key } : undefined,
      } satisfies CommercetoolsProductListIdentifier,
      type: listType as ProductListType,
      name: data.name[localeString] ||  'Unnamed List',
      description: data.description?.[localeString] || '',
      published: published,
      publishDate: publishedDate,
      image: {
        sourceUrl: image || '',
        altText: data.name[localeString] || 'List Image'
      },
    };


    return this.productListSchema.parse(result);
  }

  public parseProductListItem(
    _context: RequestContext,
    data: CommercetoolsProductListItemFactoryInput
  ): z.output<TProductListItemSchema> {

    const localeString = this.getLocaleString();
    const result = {
      identifier: {
        list: data.listIdentifier,
        key: data.lineItem.id
      },
      variant: {
        sku: data.lineItem.variant?.sku || ''
      },
      quantity: data.lineItem.quantity,
      notes: data.lineItem.custom?.fields['notes'] as string || '',
      order: data.lineItem.custom?.fields['order'] as number || 1, // Commercetools doesn't have explicit ordering
    };


    return this.productListItemSchema.parse(result);
  }

  public parseProductListPaginatedResult(
    context: RequestContext,
    data: ShoppingListPagedQueryResponse,
    query: ProductListQuery,
  ): z.output<TProductListPaginatedSchema> {

    const result = {
      items: (data.results || []).map(list => this.parseProductList(context, list)),
      pageNumber: query.search.paginationOptions.pageNumber,
      pageSize: query.search.paginationOptions.pageSize,
      totalCount: data.total || 0,
      totalPages: Math.ceil((data.total || 0) / query.search.paginationOptions.pageSize),
      identifier: query.search,
    } satisfies ProductListPaginatedResult;
    return this.productListPaginatedSchema.parse(result);
  }

  public parseProductListItemPaginatedResult(
    context: RequestContext,
    data: ShoppingList,
    query: ProductListItemsQuery,
  ): z.output<TProductListItemPaginatedSchema> {

     // fake pagination......since commercetools does not offer pagination on the lineitems.
     const originalItemCount = data.lineItems.length;
    const items = (data.lineItems || []).slice((query.search.paginationOptions.pageNumber - 1) * query.search.paginationOptions.pageSize, query.search.paginationOptions.pageNumber * query.search.paginationOptions.pageSize)

    const result = {
          items: items.map(x => this.parseProductListItem(context, {
            listIdentifier: query.search.list,
            lineItem: x,
          })),
          identifier: query.search,
          pageNumber: query.search.paginationOptions.pageNumber,
          pageSize: query.search.paginationOptions.pageSize,
          totalCount: originalItemCount,
          totalPages: Math.ceil(originalItemCount / query.search.paginationOptions.pageSize),
      } satisfies ProductListItemPaginatedResult;

      return this.productListItemPaginatedSchema.parse(result);
  }


}
