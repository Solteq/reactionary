import type { ShoppingList, ShoppingListLineItem } from '@commercetools/platform-sdk';
import type {
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListPaginatedResultsSchema,
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

  public parseProductList(
    _context: RequestContext,
    data: ProductList,
  ): z.output<TProductListSchema> {
    return this.productListSchema.parse(data);
  }

  public parseProductListItem(
    _context: RequestContext,
    data: ProductListItem,
  ): z.output<TProductListItemSchema> {
    return this.productListItemSchema.parse(data);
  }

  public parseProductListPaginatedResult(
    _context: RequestContext,
    data: ProductListPaginatedResult,
  ): z.output<TProductListPaginatedSchema> {
    return this.productListPaginatedSchema.parse(data);
  }

  public parseProductListItemPaginatedResult(
    _context: RequestContext,
    data: ProductListItemPaginatedResult,
  ): z.output<TProductListItemPaginatedSchema> {
    return this.productListItemPaginatedSchema.parse(data);
  }

  public parseListFromCommercetools(list: ShoppingList): z.output<TProductListSchema> {
    const listType = (list.custom?.fields['listType'] as ProductListType) || 'favorite';
    const image = list.custom?.fields['imageUrl'] as string | undefined;
    const published = (list.custom?.fields['published'] as boolean) && true;
    const publishDateValue = list.custom?.fields['publishedDate'] as string | undefined;
    const publishDate = publishDateValue ? new Date(publishDateValue).toISOString() : undefined;

    return this.productListSchema.parse({
      identifier: {
        listType,
        key: list.id,
      },
      type: listType,
      name: list.name['en'] || 'Unnamed List',
      description: list.description?.['en'] || '',
      published,
      publishDate,
      image: {
        sourceUrl: image || '',
        altText: list.name['en'] || 'List Image',
      },
    } satisfies ProductList);
  }

  public parseListItemFromCommercetools(
    listIdentifier: ProductListIdentifier,
    lineItem: ShoppingListLineItem,
  ): z.output<TProductListItemSchema> {
    return this.productListItemSchema.parse({
      identifier: {
        list: listIdentifier,
        key: lineItem.id,
      },
      variant: {
        sku: lineItem.variant?.sku || '',
      },
      quantity: lineItem.quantity,
      notes: (lineItem.custom?.fields['notes'] as string) || '',
      order: (lineItem.custom?.fields['order'] as number) || 1,
    } satisfies ProductListItem);
  }
}
