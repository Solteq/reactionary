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

type CategoryPathSchema = z.ZodArray<typeof CategorySchema>;

export type CategoryByIdProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryByIdSchema,
  typeof CategorySchema
>;

export type CategoryBySlugProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryBySlugSchema,
  typeof CategorySchema
>;

export type CategoryBreadcrumbPathProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryForBreadcrumbSchema,
  CategoryPathSchema
>;

export type CategoryChildCategoriesProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryForChildCategoriesSchema,
  typeof CategoryPaginatedResultSchema
>;

export type CategoryTopCategoriesProcedureDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = ProviderCapabilityProcedureDefinition<
  Context,
  ProcedureContext,
  typeof CategoryQueryForTopCategoriesSchema,
  typeof CategoryPaginatedResultSchema
>;

export type CategoryCapabilityDefinition<Context extends ProviderProcedureContext = ProviderProcedureContext> = {
  category: {
    byId: CategoryByIdProcedureDefinition<Context>;
    bySlug: CategoryBySlugProcedureDefinition<Context>;
    breadcrumbPath: CategoryBreadcrumbPathProcedureDefinition<Context>;
    childCategories: CategoryChildCategoriesProcedureDefinition<Context>;
    topCategories: CategoryTopCategoriesProcedureDefinition<Context>;
  };
};
