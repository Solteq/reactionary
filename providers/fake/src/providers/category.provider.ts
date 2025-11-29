import type { Category, CategoryPaginatedResult, CategoryQueryById, CategoryQueryBySlug, CategoryQueryForBreadcrumb, CategoryQueryForChildCategories, CategoryQueryForTopCategories, RequestContext} from "@reactionary/core";
import { CategoryPaginatedResultSchema, CategoryProvider, CategoryQueryByIdSchema, CategoryQueryBySlugSchema, CategoryQueryForBreadcrumbSchema, CategoryQueryForChildCategoriesSchema, CategoryQueryForTopCategoriesSchema, CategorySchema, Reactionary } from "@reactionary/core";
import type { FakeConfiguration } from "../schema/configuration.schema.js";
import type { Cache as ReactionaryCache } from "@reactionary/core";
import z from "zod";
import { Faker, en, base } from '@faker-js/faker';
export class FakeCategoryProvider extends CategoryProvider {

  protected config: FakeConfiguration;

  protected topCategories = new Array<Category>();
  protected childCategories = new Map<string, Array<Category>>();
  protected allCategories = new Map<string, Category>();

  protected categoryGenerator: Faker;

  protected generateFakeCategory(parent: Category | undefined, index: number): Category {
    let name: string;
    if (!parent) {
      name = this.categoryGenerator.commerce.department();
    } else {
      name = `${parent.name}-${index}`;
    }

    const identifier = { key: name.toLowerCase().replace(/\s+/g, '-') };
    const text = this.categoryGenerator.lorem.sentences(3);
    const slug = identifier.key + '-slug';

    let parentCategory;
    if (parent) {
      parentCategory = parent.identifier;
    }

    const category = {
      identifier,
      images: [],
      meta: {
        cache: {
          hit: false,
          key: ''
        },
        placeholder: false
      },
      name,
      slug,
      text,
      parentCategory
    } satisfies Category;

    this.allCategories.set(identifier.key, category);
    return category;
  }


  constructor(config: FakeConfiguration, cache: ReactionaryCache, context: RequestContext) {
    super(cache, context);
    this.config = config;
    this.categoryGenerator = new Faker({
      seed: this.config.seeds.category,
      locale: [en, base],
    });

    // Generate some top-level categories
    for (let i = 0; i < 6; i++) {
      const category = this.generateFakeCategory(undefined, i);
      this.topCategories.push(category);
    }

    // Generate two levels of child categories
    this.topCategories.forEach((parentCategory) => {
      const children = new Array<Category>();
      for (let j = 0; j < 5; j++) {
        const childCategory = this.generateFakeCategory(parentCategory, j);
        children.push(childCategory);


        const subCategoryChildren = new Array<Category>();
        for(let k = 0; k < 5; k++) {
          const subChildCategory = this.generateFakeCategory(childCategory, k);
          subCategoryChildren.push(subChildCategory);
        }
        this.childCategories.set(childCategory.identifier.key, subCategoryChildren);
      }
      this.childCategories.set(parentCategory.identifier.key, children);
    });
  }

  @Reactionary({
    inputSchema: CategoryQueryByIdSchema,
    outputSchema: CategorySchema
  })
  public override async getById(payload: CategoryQueryById): Promise<Category> {
    const category = this.allCategories.get(payload.id.key);

    if(!category) {
      throw new Error('This should not happen...');
    }
    return category;
  }

  @Reactionary({
    inputSchema: CategoryQueryBySlugSchema,
    outputSchema: CategorySchema
  })
  public override getBySlug(payload: CategoryQueryBySlug): Promise<Category | null> {
    for(const p of this.allCategories.values()) {
      if(p.slug === payload.slug) {
        return Promise.resolve(p);
      }
    }
    return Promise.resolve(null);
  }

  @Reactionary({
    inputSchema: CategoryQueryForBreadcrumbSchema,
    outputSchema: z.array(CategorySchema)
  })
  public override getBreadcrumbPathToCategory(payload: CategoryQueryForBreadcrumb): Promise<Category[]> {
    const path = new Array<Category>();
    let category = this.allCategories.get(payload.id.key);
    path.push(category!);
    while(category?.parentCategory) {
      category = this.allCategories.get(category.parentCategory.key);
      if(category) {
        path.unshift(category);
      }
    }
    return Promise.resolve(path);
  }

  @Reactionary({
    inputSchema: CategoryQueryForChildCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema
  })
  public override async findChildCategories(payload: CategoryQueryForChildCategories): Promise<CategoryPaginatedResult> {
    const children = this.childCategories.get(payload.parentId.key);
    const page = children?.slice((payload.paginationOptions.pageNumber - 1) * payload.paginationOptions.pageSize, payload.paginationOptions.pageNumber * payload.paginationOptions.pageSize);

    const res = {
      meta: {
        placeholder: false,
        cache: {
          hit: false,
          key: 'child-categories-' + payload.parentId.key + '-' + payload.paginationOptions.pageNumber + '-' + payload.paginationOptions.pageSize,
        },
      },
      items: page ? page : [],
      totalCount: children ? children.length : 0,
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalPages: children ? Math.ceil(children.length / payload.paginationOptions.pageSize) : 1,
    };

    return Promise.resolve(res);
  }

  @Reactionary({
    inputSchema: CategoryQueryForTopCategoriesSchema,
    outputSchema: CategoryPaginatedResultSchema
  })
  public override findTopCategories(payload: CategoryQueryForTopCategories): Promise<CategoryPaginatedResult> {
    const children = this.topCategories;
    const page = children?.slice((payload.paginationOptions.pageNumber - 1) * payload.paginationOptions.pageSize, payload.paginationOptions.pageNumber * payload.paginationOptions.pageSize);

    const res = {
      meta: {
        placeholder: false,
        cache: {
          hit: false,
          key: 'top' + '-' + payload.paginationOptions.pageNumber + '-' + payload.paginationOptions.pageSize,
        },
      },
      items: page ? page : [],
      totalCount: children ? children.length : 0,
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalPages: children ? Math.ceil(children.length / payload.paginationOptions.pageSize) : 1,
    };

    return Promise.resolve(res);
  }

}
