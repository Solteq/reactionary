import {
  CategorySchema,
  createClient,
  createInitialRequestContext,
  type ProcedureContext,
} from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { commercetoolsCapabilitiesInitializer } from '@reactionary/commercetools';
import * as z from 'zod';

export function getCommercetoolsConfiguration(): CommercetoolsConfiguration {
  return {
    projectKey: 'your-ct-project-key',
    authUrl: 'https://auth.europe-west1.gcp.commercetools.com',
    apiUrl: 'https://api.europe-west1.gcp.commercetools.com',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
    scopes: ['manage_project:your-ct-project-key'],
    paymentMethods: [],
    facetFieldsForSearch: [],
  };
}

export function getContext(): ProcedureContext {
  return {
    request: createInitialRequestContext(),
  };
}

const ExtendedCategorySchema = CategorySchema.extend({
  merchandisingTag: z.string(),
});

export function createExtendedCategoryClient() {
  const withCommercetools = commercetoolsCapabilitiesInitializer(
    getCommercetoolsConfiguration(),
    {
      category: true,
    },
    {
      category: {
        schema: ExtendedCategorySchema,
        transform: ({ category }) => ({
          ...category,
          merchandisingTag: category.slug.includes('sale') ? 'sale' : 'navigation',
        }),
      },
    },
  );

  return createClient(getContext(), withCommercetools);
}

const client = createExtendedCategoryClient();

const singleCategory = await client.category.bySlug.execute({
  slug: 'kitchen',
});

if (!singleCategory.success) {
  throw Error('Expected category.bySlug to succeed.');
}

console.log(singleCategory.value.merchandisingTag);

const breadcrumb = await client.category.breadcrumbPath.execute({
  id: {
    key: 'kitchen',
  },
});

if (!breadcrumb.success) {
  throw Error('Expected category.breadcrumbPath to succeed.');
}

// Each breadcrumb item is typed as ExtendedCategory.
console.log(breadcrumb.value[0]?.merchandisingTag);

const childCategories = await client.category.childCategories.execute({
  parentId: {
    key: 'kitchen',
  },
  paginationOptions: {
    pageNumber: 1,
    pageSize: 20,
  },
});

if (!childCategories.success) {
  throw Error('Expected category.childCategories to succeed.');
}

// Paginated items are also typed as ExtendedCategory.
console.log(childCategories.value.items[0]?.merchandisingTag);
