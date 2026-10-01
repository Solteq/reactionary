import type {
  Category,
  RequestContext,
  Store,
} from '@reactionary/core';
import { ReactionaryFeedGenerator } from './feed-generator.js';
import type {
  ReactionaryCategorySitemapDefinition,
  ReactionaryFeedClient,
  ReactionaryFeedDefinition,
  ReactionaryFeedGeneratorOptions,
  ReactionarySitemapDefinition,
  ReactionarySitemapEntry,
  ReactionaryStoreSitemapDefinition,
} from './feed-types.js';
import {
  assertReactionarySitemapClient,
} from './feed-types.js';

export class ReactionarySitemapGenerator {
  public constructor(
    private readonly client: ReactionaryFeedClient,
    private readonly feeds: Record<string, ReactionaryFeedDefinition>,
    private readonly options: ReactionaryFeedGeneratorOptions = {},
  ) {}

  public async *entries(
    source: ReactionarySitemapDefinition,
    requestContext: RequestContext,
  ): AsyncGenerator<ReactionarySitemapEntry> {
    assertReactionarySitemapClient(this.client, source);

    if (source.type === 'products') {
      yield* this.productEntries(source.feed, source, requestContext);
      return;
    }

    requestContext.languageContext = source.languageContext;

    if (source.type === 'categories') {
      yield* this.categoryEntries(source);
      return;
    }

    yield* this.storeEntries(source);
  }

  private async *productEntries(
    feedId: string,
    source: ReactionarySitemapDefinition,
    requestContext: RequestContext,
  ): AsyncGenerator<ReactionarySitemapEntry> {
    const feed = this.feeds[feedId];

    if (!feed) {
      throw new Error(`Product sitemap feed not found: ${feedId}`);
    }

    const generator = new ReactionaryFeedGenerator(this.client, this.options);

    for await (const product of generator.products(feed, requestContext)) {
      if (!product.url) {
        continue;
      }

      yield {
        url: product.url,
        changefreq: source.changefreq,
        priority: source.priority,
      };
    }
  }

  private async *categoryEntries(
    source: ReactionaryCategorySitemapDefinition,
  ): AsyncGenerator<ReactionarySitemapEntry> {
    const client = this.client;

    if (!client.category) {
      return;
    }

    const topCategories = this.iterCategoryPageResults((pageNumber, pageSize) =>
      client.category?.findTopCategories({
        paginationOptions: {
          pageNumber,
          pageSize,
        },
      }) ?? Promise.resolve({
        success: true,
        value: emptyCategoryPage(pageNumber, pageSize),
      }),
      source,
    );

    for await (const category of topCategories) {
      yield* this.categoryWithChildrenEntries(category, source, 1);
    }
  }

  private async *categoryWithChildrenEntries(
    category: Category,
    source: ReactionaryCategorySitemapDefinition,
    depth: number,
  ): AsyncGenerator<ReactionarySitemapEntry> {
    const url = toTemplatedUrl(source.urlTemplate, source.languageContext, {
      id: category.identifier.key,
      slug: category.slug || category.identifier.key,
    });

    if (url) {
      yield {
        url,
        changefreq: source.changefreq,
        priority: source.priority,
      };
    }

    if (source.includeChildren === false || depth >= (source.maxDepth ?? 10)) {
      return;
    }

    const client = this.client;

    if (!client.category) {
      return;
    }

    const childCategories = this.iterCategoryPageResults((pageNumber, pageSize) =>
      client.category?.findChildCategories({
        parentId: category.identifier,
        paginationOptions: {
          pageNumber,
          pageSize,
        },
      }) ?? Promise.resolve({
        success: true,
        value: emptyCategoryPage(pageNumber, pageSize),
      }),
      source,
    );

    for await (const child of childCategories) {
      yield* this.categoryWithChildrenEntries(child, source, depth + 1);
    }
  }

  private async *iterCategoryPageResults(
    loadPage: (
      pageNumber: number,
      pageSize: number,
    ) => Promise<{
      success: true;
      value: {
        items: Category[];
        totalPages: number;
      };
    } | {
      success: false;
      error: unknown;
    }>,
    source: ReactionaryCategorySitemapDefinition,
  ): AsyncGenerator<Category> {
    const pageSize = source.pageSize ?? 50;
    const maxPages = source.maxPagesPerLevel ?? 100;
    let pageNumber = 1;

    while (pageNumber <= maxPages) {
      const result = await loadPage(pageNumber, pageSize);

      if (!result.success) {
        throw new Error(JSON.stringify(result.error));
      }

      for (const category of result.value.items) {
        yield category;
      }

      if (
        pageNumber >= result.value.totalPages ||
        result.value.items.length === 0
      ) {
        return;
      }

      pageNumber += 1;
    }
  }

  private async *storeEntries(
    source: ReactionaryStoreSitemapDefinition,
  ): AsyncGenerator<ReactionarySitemapEntry> {
    const result = await this.client.store?.queryByProximity(source.proximity);

    if (!result) {
      return;
    }

    if (!result.success) {
      throw new Error(JSON.stringify(result.error));
    }

    for (const store of result.value) {
      const url = toTemplatedUrl(source.urlTemplate, source.languageContext, {
        id: store.identifier.key,
        slug: slugifyStore(store),
      });

      if (!url) {
        continue;
      }

      yield {
        url,
        changefreq: source.changefreq,
        priority: source.priority,
      };
    }
  }
}

export function toTemplatedUrl(
  urlTemplate: string,
  languageContext: { locale: string },
  values: {
    id: string;
    slug?: string;
  },
): string | undefined {
  const slug = values.slug ?? values.id;

  if (!urlTemplate) {
    return undefined;
  }

  if (
    urlTemplate.includes('{lang}') ||
    urlTemplate.includes('{slug}') ||
    urlTemplate.includes('{id}')
  ) {
    return urlTemplate
      .replaceAll('{lang}', getLanguage(languageContext))
      .replaceAll('{slug}', encodeURIComponent(slug))
      .replaceAll('{id}', encodeURIComponent(values.id));
  }

  return new URL(slug, urlTemplate).href;
}

function getLanguage(languageContext: { locale: string }): string {
  const [language] = languageContext.locale.split('-');
  return language.toLowerCase();
}

function slugifyStore(store: Store): string {
  const slug = store.name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  return slug || store.identifier.key;
}

function emptyCategoryPage(pageNumber: number, pageSize: number): {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  items: Category[];
} {
  return {
    pageNumber,
    pageSize,
    totalCount: 0,
    totalPages: 0,
    items: [],
  };
}
