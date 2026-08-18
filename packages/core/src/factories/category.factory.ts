import type * as z from 'zod';
import type { Category, CategoryPaginatedResultSchema, CategorySchema } from '../schemas/models/category.model.js';
import type { RequestContext } from '../schemas/session.schema.js';
import type { CategoryQueryForTopCategories, CategoryQueryForChildCategories } from '../schemas/queries/category.query.js';

export type AnyCategorySchema = z.ZodType<z.output<typeof CategorySchema>>;
export type AnyCategoryPaginatedResultSchema = z.ZodType<
  z.output<typeof CategoryPaginatedResultSchema>
>;

export interface CategoryFactory<
  TCategorySchema extends AnyCategorySchema = AnyCategorySchema,
  TCategoryPaginatedSchema extends AnyCategoryPaginatedResultSchema = AnyCategoryPaginatedResultSchema,
> {
  categorySchema: TCategorySchema;
  categoryPaginatedResultSchema: TCategoryPaginatedSchema;
  parseCategory(context: RequestContext, data: unknown): z.output<TCategorySchema>;
  parseCategoryPaginatedResult(
    context: RequestContext,
    data: unknown,
    query: CategoryQueryForTopCategories | CategoryQueryForChildCategories,
  ): z.output<TCategoryPaginatedSchema>;
}

export type CategoryFactoryCategoryOutput<TFactory extends CategoryFactory> =
  ReturnType<TFactory['parseCategory']>;
export type CategoryFactoryPaginatedOutput<TFactory extends CategoryFactory> =
  ReturnType<TFactory['parseCategoryPaginatedResult']>;

export type CategoryFactoryWithOutput<TFactory extends CategoryFactory> = Omit<
  TFactory,
  'parseCategory' | 'parseCategoryPaginatedResult'
> & {
  parseCategory(
    context: RequestContext,
    data: unknown,
  ): CategoryFactoryCategoryOutput<TFactory>;
  parseCategoryPaginatedResult(
    context: RequestContext,
    data: unknown,
    query: CategoryQueryForTopCategories | CategoryQueryForChildCategories,
  ): CategoryFactoryPaginatedOutput<TFactory>;
};
