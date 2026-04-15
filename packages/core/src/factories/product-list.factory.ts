import type * as z from 'zod';
import type {
  ProductListItemPaginatedResultsSchema,
  ProductListItemSchema,
  ProductListPaginatedResultsSchema,
  ProductListSchema,
} from '../schemas/models/product-list.model.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { ProductListItemsQuery, ProductListQuery } from '../schemas/queries/product-list.query.js';

export type AnyProductListSchema = z.ZodType<z.output<typeof ProductListSchema>>;
export type AnyProductListItemSchema = z.ZodType<
  z.output<typeof ProductListItemSchema>
>;
export type AnyProductListPaginatedSchema = z.ZodType<
  z.output<typeof ProductListPaginatedResultsSchema>
>;
export type AnyProductListItemPaginatedSchema = z.ZodType<
  z.output<typeof ProductListItemPaginatedResultsSchema>
>;

export interface ProductListFactory<
  TProductListSchema extends AnyProductListSchema = AnyProductListSchema,
  TProductListItemSchema extends AnyProductListItemSchema = AnyProductListItemSchema,
  TProductListPaginatedSchema extends AnyProductListPaginatedSchema = AnyProductListPaginatedSchema,
  TProductListItemPaginatedSchema extends AnyProductListItemPaginatedSchema = AnyProductListItemPaginatedSchema,
> {
  productListSchema: TProductListSchema;
  productListItemSchema: TProductListItemSchema;
  productListPaginatedSchema: TProductListPaginatedSchema;
  productListItemPaginatedSchema: TProductListItemPaginatedSchema;
  parseProductList(
    context: RequestContext,
    data: unknown,
  ): z.output<TProductListSchema>;
  parseProductListItem(
    context: RequestContext,
    data: unknown,
  ): z.output<TProductListItemSchema>;
  parseProductListPaginatedResult(
    context: RequestContext,
    data: unknown,
    query: ProductListQuery,
  ): z.output<TProductListPaginatedSchema>;
  parseProductListItemPaginatedResult(
    context: RequestContext,
    data: unknown,
    query: ProductListItemsQuery,
  ): z.output<TProductListItemPaginatedSchema>;
}

export type ProductListFactoryListOutput<TFactory extends ProductListFactory> =
  ReturnType<TFactory['parseProductList']>;
export type ProductListFactoryItemOutput<TFactory extends ProductListFactory> =
  ReturnType<TFactory['parseProductListItem']>;
export type ProductListFactoryListPaginatedOutput<TFactory extends ProductListFactory> =
  ReturnType<TFactory['parseProductListPaginatedResult']>;
export type ProductListFactoryItemPaginatedOutput<TFactory extends ProductListFactory> =
  ReturnType<TFactory['parseProductListItemPaginatedResult']>;

export type ProductListFactoryWithOutput<TFactory extends ProductListFactory> =
  Omit<
    TFactory,
    | 'parseProductList'
    | 'parseProductListItem'
    | 'parseProductListPaginatedResult'
    | 'parseProductListItemPaginatedResult'
  > & {
    parseProductList(
      context: RequestContext,
      data: unknown,
    ): ProductListFactoryListOutput<TFactory>;
    parseProductListItem(
      context: RequestContext,
      data: unknown,
    ): ProductListFactoryItemOutput<TFactory>;
    parseProductListPaginatedResult(
      context: RequestContext,
      data: unknown,
      query: ProductListQuery,
    ): ProductListFactoryListPaginatedOutput<TFactory>;
    parseProductListItemPaginatedResult(
      context: RequestContext,
      data: unknown,
      query: ProductListItemsQuery,
    ): ProductListFactoryItemPaginatedOutput<TFactory>;
  };
