import type {
  AnyCategoryPaginatedResultSchema,
  AnyCategorySchema,
  CategoryFactory,
  CategoryPaginatedResultSchema,
  CategorySchema,
  RequestContext,
} from '@reactionary/core';
import type * as z from 'zod';

export class FakeCategoryFactory<
  TCategorySchema extends AnyCategorySchema = typeof CategorySchema,
  TCategoryPaginatedSchema extends AnyCategoryPaginatedResultSchema = typeof CategoryPaginatedResultSchema,
> implements CategoryFactory<TCategorySchema, TCategoryPaginatedSchema>
{
  public readonly categorySchema: TCategorySchema;
  public readonly categoryPaginatedResultSchema: TCategoryPaginatedSchema;

  constructor(
    categorySchema: TCategorySchema,
    categoryPaginatedResultSchema: TCategoryPaginatedSchema,
  ) {
    this.categorySchema = categorySchema;
    this.categoryPaginatedResultSchema = categoryPaginatedResultSchema;
  }

  public parseCategory(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCategorySchema> {
    return this.categorySchema.parse(data);
  }

  public parseCategoryPaginatedResult(
    _context: RequestContext,
    data: unknown,
  ): z.output<TCategoryPaginatedSchema> {
    return this.categoryPaginatedResultSchema.parse(data);
  }
}
