import type {
  Cache,
  Category,
  CategoryFactory,
  CategoryFactoryCategoryOutput,
  CategoryFactoryPaginatedOutput,
  CategoryFactoryWithOutput,
  CategoryPaginatedResult,
  CategoryQueryById,
  CategoryQueryBySlug,
  CategoryQueryForBreadcrumb,
  CategoryQueryForChildCategories,
  CategoryQueryForTopCategories,
  NotFoundError,
  RequestContext,
  Result,
} from '@reactionary/core';
import {
  CategoryPaginatedResultSchema,
  CategoryCapability,
  CategoryQueryByIdSchema,
  CategoryQueryBySlugSchema,
  CategoryQueryForBreadcrumbSchema,
  CategoryQueryForChildCategoriesSchema,
  CategoryQueryForTopCategoriesSchema,
  CategorySchema,
  Reactionary,
  error,
  success,
} from '@reactionary/core';
import type { FakeConfiguration } from '../schema/configuration.schema.js';
import * as z from 'zod';
import { Faker, en, base } from '@faker-js/faker';
import type { FakeCategoryFactory } from '../factories/category/category.factory.js';

export class FakeCategoryCapability<
  TFactory extends CategoryFactory = FakeCategoryFactory,
> extends CategoryCapability<
  CategoryFactoryCategoryOutput<TFactory>,
  CategoryFactoryPaginatedOutput<TFactory>
> {
  protected config: FakeConfiguration;
  protected factory: CategoryFactoryWithOutput<TFactory>;

  protected topCategories: Category[] = [];
  protected childCategories = new Map<string, Category[]>();
  protected allCategories = new Map<string, Category>();

  protected categoryGenerator: Faker;

  protected generateFakeCategory(parent: Category | undefined, index: number): Category {
    const name = parent
      ? `${parent.name}-${index}`
      : this.categoryGenerator.commerce.department();

    const identifier = { key: name.toLowerCase().replace(/\s+/g, '-') };
    const category = {
      identifier,
      images: [],
      name,
      slug: `${identifier.key}-slug`,
      text: this.categoryGenerator.lorem.sentences(3),
      parentCategory: parent?.identifier,
    } satisfies Category;

    this.allCategories.set(identifier.key, category);
    return category;
  }

  constructor(
    config: FakeConfiguration,
    cache: Cache,
    context: RequestContext,
    factory: CategoryFactoryWithOutput<TFactory>,
  ) {
    super(cache, context);
    this.config = config;
    this.factory = factory;
    this.categoryGenerator = new Faker({
      seed: this.config.seeds.category,
      locale: [en, base],
    });

    for (let i = 0; i < 6; i++) {
      this.topCategories.push(this.generateFakeCategory(undefined, i));
    }

    this.topCategories.forEach((parentCategory) => {
      const children: Category[] = [];
      for (let j = 0; j < 5; j++) {
        const childCategory = this.generateFakeCategory(parentCategory, j);
        children.push(childCategory);

        const subCategoryChildren: Category[] = [];
        for (let k = 0; k < 5; k++) {
          subCategoryChildren.push(this.generateFakeCategory(childCategory, k));
        }
        this.childCategories.set(childCategory.identifier.key, subCategoryChildren);
      }
      this.childCategories.set(parentCategory.identifier.key, children);
    });
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema,
  })
  public override async getById(
    payload: CategoryQueryById,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    const category = this.allCategories.get(payload.id.key);

    if (!category) {
      return error<NotFoundError>({
        type: 'NotFound',
        identifier: payload,
      });
    }

    return success(this.factory.parseCategory(this.context, category));
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema,
  })
  public override async getBySlug(
    payload: CategoryQueryBySlug,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>, NotFoundError>> {
    for (const category of this.allCategories.values()) {
      if (category.slug === payload.slug) {
        return success(this.factory.parseCategory(this.context, category));
      }
    }

    return error<NotFoundError>({
      type: 'NotFound',
      identifier: payload,
    });
  }

  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema),
  })
  public override async getBreadcrumbPathToCategory(
    payload: CategoryQueryForBreadcrumb,
  ): Promise<Result<CategoryFactoryCategoryOutput<TFactory>[]>> {
    const path: Category[] = [];
    let next = this.allCategories.get(payload.id.key);

    while (next) {
      path.unshift(next);
      if (!next.parentCategory) {
        break;
      }
      next = this.allCategories.get(next.parentCategory.key);
    }

    return success(path.map((x) => this.factory.parseCategory(this.context, x)));
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findTopCategories(
    _payload: CategoryQueryForTopCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    const result = {
      items: this.topCategories,
      pageSize: this.topCategories.length,
      pageNumber: 1,
      totalCount: this.topCategories.length,
      totalPages: 1,
    } satisfies CategoryPaginatedResult;

    return success(this.factory.parseCategoryPaginatedResult(this.context, result));
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema,
  })
  public override async findChildCategories(
    payload: CategoryQueryForChildCategories,
  ): Promise<Result<CategoryFactoryPaginatedOutput<TFactory>>> {
    const items = this.childCategories.get(payload.parentId.key) || [];
    const result = {
      items,
      pageSize: items.length,
      pageNumber: 1,
      totalCount: items.length,
      totalPages: 1,
    } satisfies CategoryPaginatedResult;

    return success(this.factory.parseCategoryPaginatedResult(this.context, result));
  }
}
