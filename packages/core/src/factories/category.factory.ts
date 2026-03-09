import type * as z from 'zod';
import type { CategoryPaginatedResultSchema, CategorySchema } from '../schemas/models/category.model.js';
import type { RequestContext } from '../schemas/session.schema.js';

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
  ): CategoryFactoryPaginatedOutput<TFactory>;
};
