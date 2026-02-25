import { CategorySchema, type CategoryCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { createCommercetoolsCategoryBreadcrumbPath } from './category-breadcrumb-path.js';
import { createCommercetoolsCategoryById } from './category-by-id.js';
import { createCommercetoolsCategoryBySlug } from './category-by-slug.js';
import { createCommercetoolsCategoryChildCategories } from './category-child-categories.js';
import { createCommercetoolsCategoryTopCategories } from './category-top-categories.js';
import {
  resolveCommercetoolsCategoryExtension,
  type CommercetoolsCategoryExtension,
} from './category-extension.js';
import * as z from 'zod';

export function createCommercetoolsCategoryCapability<
  CategoryOutputSchema extends z.ZodTypeAny = typeof CategorySchema,
  CategoryPathOutputSchema extends z.ZodTypeAny = z.ZodArray<CategoryOutputSchema>,
  CategoryPaginatedOutputSchema extends z.ZodTypeAny = z.ZodTypeAny,
>(
  extension: CommercetoolsCategoryExtension<
    CategoryOutputSchema,
    CategoryPathOutputSchema,
    CategoryPaginatedOutputSchema
  >
) {
  const resolvedExtension = resolveCommercetoolsCategoryExtension(extension);
  return {
    category: {
      byId: createCommercetoolsCategoryById(resolvedExtension),
      bySlug: createCommercetoolsCategoryBySlug(resolvedExtension),
      breadcrumbPath: createCommercetoolsCategoryBreadcrumbPath(resolvedExtension),
      childCategories: createCommercetoolsCategoryChildCategories(resolvedExtension),
      topCategories: createCommercetoolsCategoryTopCategories(resolvedExtension),
    },
  } satisfies CategoryCapabilityDefinition<
    CommercetoolsProcedureContext,
    CategoryOutputSchema,
    CategoryPathOutputSchema,
    CategoryPaginatedOutputSchema
  >;
}

export const commercetoolsCategoryCapability =
  createCommercetoolsCategoryCapability({
    schema: CategorySchema,
  });
