import type { CategoryCapabilityDefinition } from '@reactionary/core';
import type { CommercetoolsProcedureContext } from '../../core/context.js';
import { commercetoolsCategoryBreadcrumbPath } from './category-breadcrumb-path.js';
import { commercetoolsCategoryById } from './category-by-id.js';
import { commercetoolsCategoryBySlug } from './category-by-slug.js';
import { commercetoolsCategoryChildCategories } from './category-child-categories.js';
import { commercetoolsCategoryTopCategories } from './category-top-categories.js';

export const commercetoolsCategoryCapability = {
  category: {
    byId: commercetoolsCategoryById,
    bySlug: commercetoolsCategoryBySlug,
    breadcrumbPath: commercetoolsCategoryBreadcrumbPath,
    childCategories: commercetoolsCategoryChildCategories,
    topCategories: commercetoolsCategoryTopCategories,
  },
} satisfies CategoryCapabilityDefinition<CommercetoolsProcedureContext>;
