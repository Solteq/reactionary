import 'dotenv/config';
import { createInitialRequestContext } from '@reactionary/core';
import type { CommercetoolsConfiguration } from '@reactionary/provider-commercetools';
import { commercetoolsCapabilitiesInitializer } from '../lib/core/initialize.js';

const requiredEnv = [
  'CTP_API_URL',
  'CTP_AUTH_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_PROJECT_KEY',
] as const;

const hasRequiredEnv = requiredEnv.every((key) => {
  const value = process.env[key];
  return typeof value === 'string' && value.length > 0;
});

function buildConfigurationFromEnv(): CommercetoolsConfiguration {
  return {
    apiUrl: process.env['CTP_API_URL'] ?? '',
    authUrl: process.env['CTP_AUTH_URL'] ?? '',
    clientId: process.env['CTP_CLIENT_ID'] ?? '',
    clientSecret: process.env['CTP_CLIENT_SECRET'] ?? '',
    projectKey: process.env['CTP_PROJECT_KEY'] ?? '',
    scopes: (process.env['CTP_SCOPES'] ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0),
    facetFieldsForSearch: (process.env['CTP_FACET_FIELDS_FOR_SEARCH'] ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x.length > 0),
    paymentMethods: [],
  };
}

const describeLive = hasRequiredEnv ? describe : describe.skip;

describeLive('live commercetools v2 category procedures', () => {
  const config = buildConfigurationFromEnv();
  const request = createInitialRequestContext();
  const context = { request };
  const client = commercetoolsCapabilitiesInitializer(config, {
    category: true,
  })(context);

  it('can fetch top categories', async () => {
    const result = await client.category.topCategories.execute({
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected topCategories to succeed');
    }

    expect(result.value.pageNumber).toBe(1);
    expect(result.value.pageSize).toBeGreaterThanOrEqual(0);
    expect(result.value.pageSize).toBeLessThanOrEqual(10);
    expect(result.value.totalCount).toBeGreaterThanOrEqual(0);
    expect(result.value.totalPages).toBeGreaterThanOrEqual(0);
  });

  it('can fetch category by id', async () => {
    const top = await client.category.topCategories.execute({
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    });
    expect(top.success).toBe(true);
    if (!top.success || top.value.items.length === 0) {
      throw new Error('Expected at least one top category');
    }

    const categoryId = top.value.items[0].identifier.key;
    const result = await client.category.byId.execute({
      id: { key: categoryId },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected byId to succeed');
    }

    expect(result.value.identifier.key).toBe(categoryId);
  });

  it('can fetch category by slug', async () => {
    const top = await client.category.topCategories.execute({
      paginationOptions: {
        pageNumber: 1,
        pageSize: 20,
      },
    });
    expect(top.success).toBe(true);
    if (!top.success) {
      throw new Error('Expected topCategories to succeed');
    }

    const withSlug = top.value.items.find((x) => x.slug && x.slug.length > 0);
    if (!withSlug) {
      throw new Error('Expected at least one top category with a slug');
    }

    const result = await client.category.bySlug.execute({
      slug: withSlug.slug,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected bySlug to succeed');
    }

    expect(result.value.identifier.key).toBe(withSlug.identifier.key);
  });

  it('can fetch breadcrumb path to a category', async () => {
    const top = await client.category.topCategories.execute({
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    });
    expect(top.success).toBe(true);
    if (!top.success || top.value.items.length === 0) {
      throw new Error('Expected at least one top category');
    }

    const leafKey = top.value.items[0].identifier.key;
    const result = await client.category.breadcrumbPath.execute({
      id: { key: leafKey },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected breadcrumbPath to succeed');
    }

    expect(result.value.length).toBeGreaterThan(0);
    expect(result.value[result.value.length - 1]?.identifier.key).toBe(leafKey);
  });

  it('can fetch child categories for a category', async () => {
    const top = await client.category.topCategories.execute({
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    });
    expect(top.success).toBe(true);
    if (!top.success || top.value.items.length === 0) {
      throw new Error('Expected at least one top category');
    }

    const parentKey = top.value.items[0].identifier.key;
    const result = await client.category.childCategories.execute({
      parentId: { key: parentKey },
      paginationOptions: {
        pageNumber: 1,
        pageSize: 10,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error('Expected childCategories to succeed');
    }

    expect(result.value.pageNumber).toBe(1);
    expect(result.value.pageSize).toBeGreaterThanOrEqual(0);
    expect(result.value.pageSize).toBeLessThanOrEqual(10);
    expect(result.value.totalCount).toBeGreaterThanOrEqual(0);
  });

  it('returns NotFound when byId category does not exist', async () => {
    const result = await client.category.byId.execute({
      id: { key: 'reactionary-non-existent-category' },
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected byId to fail');
    }

    expect(result.error.type).toBe('NotFound');
  });

  it('returns NotFound when bySlug category does not exist', async () => {
    const result = await client.category.bySlug.execute({
      slug: 'reactionary-non-existent-slug',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected bySlug to fail');
    }

    expect(result.error.type).toBe('NotFound');
  });
});
