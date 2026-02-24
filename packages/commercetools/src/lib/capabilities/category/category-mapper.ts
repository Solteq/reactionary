import type { Category, CategoryIdentifier, CategoryPaginatedResult } from '@reactionary/core';
import type {
  Category as CommercetoolsCategory,
  CategoryPagedQueryResponse as CommercetoolsCategoryPagedQueryResponse,
} from '@commercetools/platform-sdk';

function localize(
  value: Record<string, string> | undefined,
  locale: string,
  fallback = '',
) {
  return value?.[locale] ?? fallback;
}

export function parseCommercetoolsCategory(
  body: CommercetoolsCategory,
  locale: string,
): Category {
  const identifier = { key: body.key ?? '' } satisfies CategoryIdentifier;

  return {
    identifier,
    name: localize(body.name, locale, 'No Name'),
    slug: localize(body.slug, locale, ''),
    text: localize(body.description, locale, ''),
    parentCategory: body.parent?.obj?.key ? { key: body.parent.obj.key } : undefined,
    images: (body.assets ?? [])
      .filter((asset) => (asset.sources?.length ?? 0) > 0)
      .filter((asset) => asset.sources?.[0]?.contentType?.startsWith('image/'))
      .map((asset) => {
        const source = asset.sources![0];
        return {
          sourceUrl: source.uri,
          altText: localize(asset.description, locale, localize(asset.name, locale, '')),
          height: source.dimensions?.h ?? 0,
          width: source.dimensions?.w ?? 0,
        };
      }),
  } satisfies Category;
}

export function parseCommercetoolsCategoryPaginatedResult(
  body: CommercetoolsCategoryPagedQueryResponse,
  locale: string,
): CategoryPaginatedResult {
  const pageSize = body.count;
  const totalCount = body.total ?? 0;
  const pageNumber = pageSize > 0 ? Math.floor(body.offset / pageSize) + 1 : 1;
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;

  return {
    pageNumber,
    pageSize,
    totalCount,
    totalPages,
    items: body.results.map((entry) => parseCommercetoolsCategory(entry, locale)),
  } satisfies CategoryPaginatedResult;
}

export function createEmptyCategoryPaginatedResult(
  pageNumber: number,
  pageSize: number,
): CategoryPaginatedResult {
  return {
    items: [],
    pageNumber,
    pageSize,
    totalCount: 0,
    totalPages: 0,
  } satisfies CategoryPaginatedResult;
}
