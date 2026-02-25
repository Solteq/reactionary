import type * as z from 'zod';
import type {
  CategoryPaginatedResultSchema,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
} from '../../schemas/index.js';
import type { ProviderProcedureContext, ProviderCapabilityProcedureDefinition, ProcedureContext } from '../core/provider-capability-procedure-definition.js';

type CategoryPathSchema<OutputSchema extends z.ZodTypeAny = typeof CategorySchema> = z.ZodArray<OutputSchema>;

export type CategoryByIdProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  CategoryOutputSchema extends z.ZodTypeAny = typeof CategorySchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryByIdSchema,
  CategoryOutputSchema
>;

export type CategoryBySlugProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  CategoryOutputSchema extends z.ZodTypeAny = typeof CategorySchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryBySlugSchema,
  CategoryOutputSchema
>;

export type CategoryBreadcrumbPathProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  CategoryOutputSchema extends z.ZodTypeAny = typeof CategorySchema,
  CategoryPathOutputSchema extends z.ZodTypeAny = CategoryPathSchema<CategoryOutputSchema>
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryForBreadcrumbSchema,
  CategoryPathOutputSchema
>;

export type CategoryChildCategoriesProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny = typeof CategoryPaginatedResultSchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryForChildCategoriesSchema,
  CategoryPaginatedOutputSchema
>;

export type CategoryTopCategoriesProcedureDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny = typeof CategoryPaginatedResultSchema
> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryForTopCategoriesSchema,
  CategoryPaginatedOutputSchema
>;

export type CategoryCapabilityDefinition<
  Context extends ProviderProcedureContext = ProviderProcedureContext,
  CategoryOutputSchema extends z.ZodTypeAny = typeof CategorySchema,
  CategoryPathOutputSchema extends z.ZodTypeAny = CategoryPathSchema<CategoryOutputSchema>,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny = typeof CategoryPaginatedResultSchema
> = {
  category: {
    byId: CategoryByIdProcedureDefinition<Context, CategoryOutputSchema>;
    bySlug: CategoryBySlugProcedureDefinition<Context, CategoryOutputSchema>;
    breadcrumbPath: CategoryBreadcrumbPathProcedureDefinition<
      Context,
      CategoryOutputSchema,
      CategoryPathOutputSchema
    >;
    childCategories: CategoryChildCategoriesProcedureDefinition<
      Context,
      CategoryPaginatedOutputSchema
    >;
    topCategories: CategoryTopCategoriesProcedureDefinition<
      Context,
      CategoryPaginatedOutputSchema
    >;
  };
};
