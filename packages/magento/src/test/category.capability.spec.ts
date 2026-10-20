import {
  CategoryPaginatedResultSchema,
  CategorySchema,
  MemoryCache,
  createInitialRequestContext,
} from '@reactionary/core';
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { MagentoCategoryCapability } from '../capabilities/category.capability.js';
import { MagentoClient } from '../core/client.js';
import { MagentoApiError } from '../core/errors.js';
import { MagentoCategoryFactory } from '../factories/category/category.factory.js';
import { MagentoConfigurationSchema } from '../schema/configuration.schema.js';
import type { MagentoCategory } from '../schema/magento.types.js';

const config = MagentoConfigurationSchema.parse({
  adminApiKey: 'token',
  baseUrl: 'https://shop.example.com',
  allCurrencies: ['EUR'],
  rootCategoryId: '40',
});

function category(id: number, parentId: number, path: string, externalId?: string, extra: Partial<MagentoCategory> = {}): MagentoCategory {
  return {
    id,
    parent_id: parentId,
    name: `Category ${id}`,
    is_active: true,
    path,
    custom_attributes: [
      ...(externalId ? [{ attribute_code: 'external_id', value: externalId }] : []),
      { attribute_code: 'url_key', value: `category-${id}` },
    ],
    ...extra,
  };
}

/**
 * A store root (40) whose children have *lower* entity ids than the root, which
 * the old "id > root" ancestor heuristic got wrong. 8 is inactive.
 */
const TREE: MagentoCategory[] = [
  category(40, 1, '1/40', 'ROOT'),
  category(5, 40, '1/40/5', 'WOMEN'),
  category(7, 5, '1/40/5/7', 'TOPS'),
  category(8, 5, '1/40/5/8', 'HIDDEN', { is_active: false }),
  category(11, 8, '1/40/5/8/11', 'SALE'),
  category(9, 7, '1/40/5/7/9', undefined, {
    custom_attributes: [
      { attribute_code: 'url_key', value: 'tees' },
      { attribute_code: 'description', value: '<p>All tees</p>' },
      { attribute_code: 'image', value: '/media/catalog/category/tees.jpg' },
    ],
  }),
  category(3, 2, '1/2/3', 'OTHER-STORE'),
];

interface ParsedFilter {
  field: string;
  value: string;
  condition: string;
}

function parseGroups(path: string): ParsedFilter[][] {
  const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
  const groups: ParsedFilter[][] = [];
  for (let g = 0; params.has(`searchCriteria[filterGroups][${g}][filters][0][field]`); g++) {
    const group: ParsedFilter[] = [];
    for (let f = 0; params.has(`searchCriteria[filterGroups][${g}][filters][${f}][field]`); f++) {
      const prefix = `searchCriteria[filterGroups][${g}][filters][${f}]`;
      group.push({
        field: params.get(`${prefix}[field]`) ?? '',
        value: params.get(`${prefix}[value]`) ?? '',
        condition: params.get(`${prefix}[condition_type]`) ?? '',
      });
    }
    groups.push(group);
  }
  return groups;
}

function fieldValue(item: MagentoCategory, field: string): string {
  switch (field) {
    case 'entity_id':
      return String(item.id);
    case 'parent_id':
      return String(item.parent_id);
    case 'is_active':
      return item.is_active ? '1' : '0';
    case 'path':
      return item.path ?? '';
    default:
      return String(item.custom_attributes?.find((a) => a.attribute_code === field)?.value ?? '');
  }
}

function matches(item: MagentoCategory, filter: ParsedFilter): boolean {
  const actual = fieldValue(item, filter.field);
  if (filter.condition === 'in') return filter.value.split(',').includes(actual);
  if (filter.condition === 'like') {
    const pattern = new RegExp(`^${filter.value.split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    return pattern.test(actual);
  }
  return actual === filter.value;
}

/** A tiny in-memory `/V1/categories/list` that honours AND-of-OR filter groups. */
function categoriesList(path: string) {
  const groups = parseGroups(path);
  const items = TREE.filter((item) => groups.every((group) => group.some((filter) => matches(item, filter))));
  return { items, total_count: items.length };
}

describe('MagentoCategoryCapability', () => {
  let client: MagentoClient;
  let catalogRequest: MockInstance<MagentoClient['catalogRequest']>;
  let capability: MagentoCategoryCapability;

  beforeEach(() => {
    client = new MagentoClient(config, createInitialRequestContext());
    catalogRequest = vi.spyOn(client, 'catalogRequest').mockImplementation(async (path: string) => categoriesList(path));
    capability = new MagentoCategoryCapability(
      config,
      new MemoryCache(),
      createInitialRequestContext(),
      client,
      new MagentoCategoryFactory(CategorySchema, CategoryPaginatedResultSchema, config),
    );
  });

  it('gets a category by external_id with its parent keyed by external_id', async () => {
    const result = await capability.getById({ id: { key: 'WOMEN' } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.identifier.key).toBe('WOMEN');
    // A child of the store root is a top-level category.
    expect(result.value.parentCategory).toBeUndefined();
  });

  it('returns NotFound for inactive categories and categories of another store tree', async () => {
    for (const key of ['HIDDEN', 'OTHER-STORE', 'NOPE']) {
      const result = await capability.getById({ id: { key } });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.type).toBe('NotFound');
    }
  });

  it('returns a typed error instead of throwing when Magento fails', async () => {
    catalogRequest.mockRejectedValue(
      new MagentoApiError({ transport: 'rest', status: 500, method: 'GET', url: 'https://shop.example.com/rest' }),
    );
    const result = await capability.getBreadcrumbPathToCategory({ id: { key: 'WOMEN' } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('Generic');
  });

  it('builds the breadcrumb from the category path, root-most first', async () => {
    // Category 9 has no external_id and is therefore keyed by its entity id.
    const result = await capability.getBreadcrumbPathToCategory({ id: { key: '9' } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.map((c) => [c.identifier.key, c.parentCategory?.key])).toEqual([
      ['WOMEN', undefined],
      ['TOPS', 'WOMEN'],
      ['9', 'TOPS'],
    ]);
  });

  it('leaves inactive ancestors out of the breadcrumb', async () => {
    const result = await capability.getBreadcrumbPathToCategory({ id: { key: 'SALE' } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.map((c) => c.identifier.key)).toEqual(['WOMEN', 'SALE']);
  });

  it('returns NotFound for the breadcrumb of an unknown category', async () => {
    const result = await capability.getBreadcrumbPathToCategory({ id: { key: 'NOPE' } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.type).toBe('NotFound');
  });

  it('resolves a non-numeric parent external_id instead of producing NaN', async () => {
    const result = await capability.getBySlug({ slug: 'tees' });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.identifier.key).toBe('9');
    expect(result.value.parentCategory).toEqual({ key: 'TOPS' });
    expect(result.value.text).toBe('<p>All tees</p>');
    expect(result.value.images.map((i) => i.sourceUrl)).toEqual([
      'https://shop.example.com/media/catalog/category/tees.jpg',
    ]);
  });

  it('restricts slug lookups to active categories beneath the store root', async () => {
    await capability.getBySlug({ slug: 'category-3' });
    const listCall = catalogRequest.mock.calls.find(([path]) => path.includes('url_key'));
    expect(listCall).toBeDefined();
    if (!listCall) return;
    expect(parseGroups(listCall[0])).toEqual([
      [{ field: 'url_key', value: 'category-3', condition: 'eq' }],
      [{ field: 'is_active', value: '1', condition: 'eq' }],
      [{ field: 'path', value: '%/40/%', condition: 'like' }],
    ]);
  });

  it('lists child categories with the requested key as parent', async () => {
    const result = await capability.findChildCategories({
      parentId: { key: 'ROOT' },
      paginationOptions: { pageNumber: 1, pageSize: 10 },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items.map((c) => [c.identifier.key, c.parentCategory?.key])).toEqual([['WOMEN', 'ROOT']]);
  });

  it('returns NotFound for children of an unknown category and does not cache the miss', async () => {
    const payload = { parentId: { key: 'GHOST' }, paginationOptions: { pageNumber: 1, pageSize: 10 } };
    const first = await capability.findChildCategories(payload);
    expect(first.success).toBe(false);
    if (!first.success) expect(first.error.type).toBe('NotFound');

    const callsAfterFirst = catalogRequest.mock.calls.length;
    await capability.findChildCategories(payload);
    expect(catalogRequest.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('lists active top categories without a parent', async () => {
    const result = await capability.findTopCategories({ paginationOptions: { pageNumber: 1, pageSize: 10 } });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.items.map((c) => [c.identifier.key, c.parentCategory])).toEqual([['WOMEN', undefined]]);
  });
});
