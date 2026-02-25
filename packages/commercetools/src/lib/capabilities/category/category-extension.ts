import {
  CategoryPaginatedResultSchema,
  CategorySchema,
  type Category,
  type CategoryPaginatedResult,
  type ProcedureContext,
} from '@reactionary/core';
import type { Category as CommercetoolsCategory } from '@commercetools/platform-sdk';
import * as z from 'zod';

type CategoryPaginatedResultWithItems<TCategory> = Omit<
  CategoryPaginatedResult,
  'items'
> & {
  items: TCategory[];
};

export type CommercetoolsCategoryTransformContext = {
  category: Category;
  rawCategory: CommercetoolsCategory;
  context: ProcedureContext;
};

export type CommercetoolsCategoryExtension<
  CategoryOutputSchema extends z.ZodTypeAny = typeof CategorySchema,
  CategoryPathOutputSchema extends z.ZodTypeAny = z.ZodArray<CategoryOutputSchema>,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny = z.ZodType<
    CategoryPaginatedResultWithItems<z.infer<CategoryOutputSchema>>
  >,
> = {
  schema: CategoryOutputSchema;
  breadcrumbPathSchema?: CategoryPathOutputSchema;
  paginatedSchema?: CategoryPaginatedOutputSchema;
  transform?: (
    input: CommercetoolsCategoryTransformContext
  ) => z.infer<CategoryOutputSchema> | Promise<z.infer<CategoryOutputSchema>>;
};

export type CommercetoolsResolvedCategoryExtension<
  CategoryOutputSchema extends z.ZodTypeAny,
  CategoryPathOutputSchema extends z.ZodTypeAny,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny,
> = {
  schema: CategoryOutputSchema;
  breadcrumbPathSchema: CategoryPathOutputSchema;
  paginatedSchema: CategoryPaginatedOutputSchema;
  transform?: (
    input: CommercetoolsCategoryTransformContext
  ) => z.infer<CategoryOutputSchema> | Promise<z.infer<CategoryOutputSchema>>;
};

function createDefaultPaginatedSchema<
  CategoryOutputSchema extends z.ZodTypeAny,
>(schema: CategoryOutputSchema) {
  return CategoryPaginatedResultSchema.extend({
    items: z.array(schema),
  }) as z.ZodType<CategoryPaginatedResultWithItems<z.infer<CategoryOutputSchema>>>;
}

export function resolveCommercetoolsCategoryExtension<
  CategoryOutputSchema extends z.ZodTypeAny,
  CategoryPathOutputSchema extends z.ZodTypeAny,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny,
>(
  extension: CommercetoolsCategoryExtension<
    CategoryOutputSchema,
    CategoryPathOutputSchema,
    CategoryPaginatedOutputSchema
  >,
): CommercetoolsResolvedCategoryExtension<
  CategoryOutputSchema,
  CategoryPathOutputSchema,
  CategoryPaginatedOutputSchema
> {
  return {
    schema: extension.schema,
    breadcrumbPathSchema:
      (extension.breadcrumbPathSchema ||
        z.array(extension.schema)) as CategoryPathOutputSchema,
    paginatedSchema:
      (extension.paginatedSchema ||
        createDefaultPaginatedSchema(extension.schema)) as CategoryPaginatedOutputSchema,
    transform: extension.transform,
  };
}
