import type { Category, CategoryQueryById, CategoryQueryBySlug, CategoryQueryForBreadcrumb, CategoryQueryForChildCategories, CategoryQueryForTopCategories, RequestContext} from "@reactionary/core";
import { CategoryProvider, Reactionary, Session } from "@reactionary/core";
import type { FakeConfiguration } from "../schema/configuration.schema";
import type { Cache as ReactionaryCache } from "@reactionary/core";
import type z from "zod";
import { Faker, en, base } from '@faker-js/faker';
export class FakeCategoryProvider<
  T extends Category = Category
> extends CategoryProvider<T> {

  protected config: FakeConfiguration;

  protected topCategories = new Array<T>();
  protected childCategories = new Map<string, Array<T>>();
  protected allCategories = new Map<string, T>();

  protected categoryGenerator: Faker;

  protected generateFakeCategory(parent: Category | undefined, index: number): T {

    let name: string;
    if (!parent) {
      name = this.categoryGenerator.commerce.department();
    } else {
      name = `${parent.name}-${index}`;
    }

    const category: T = this.newModel();
    category.identifier = { key: name.toLowerCase().replace(/\s+/g, '-') };
    category.name = name;
    category.text = this.categoryGenerator.lorem.sentences(3);
    category.slug = category.identifier.key + '-slug';
    if (parent) {
      category.parentCategory = parent.identifier;
    }
    this.allCategories.set(category.identifier.key, category);
    return category;
  }


  constructor(config: FakeConfiguration, schema: z.ZodType<T>, cache: ReactionaryCache) {
    super(schema, cache);
    this.config = config;
    this.categoryGenerator = new Faker({
      seed: this.config.seeds.category,
      locale: [en, base],
    });

    // Generate some top-level categories
    for (let i = 0; i < 6; i++) {
      const category: T = this.generateFakeCategory(undefined, i);
      this.topCategories.push(category);
    }

    // Generate two levels of child categories
    this.topCategories.forEach((parentCategory) => {
      const children = new Array<T>();
      for (let j = 0; j < 5; j++) {
        const childCategory: T = this.generateFakeCategory(parentCategory, j);
        children.push(childCategory);


        const subCategoryChildren = new Array<T>();
        for(let k = 0; k < 5; k++) {
          const subChildCategory: T = this.generateFakeCategory(childCategory, k);
          subCategoryChildren.push(subChildCategory);
        }
        this.childCategories.set(childCategory.identifier.key, subCategoryChildren);
      }
      this.childCategories.set(parentCategory.identifier.key, children);
    });
  }

  @Reactionary({})
  public override async getById(payload: CategoryQueryById, reqCtx: RequestContext): Promise<T> {
    const category = this.allCategories.get(payload.id.key);

    if(!category) {
      const dummyCategory = this.newModel();
      dummyCategory.meta.placeholder = true;
      dummyCategory.identifier = { key: payload.id.key };
      return dummyCategory;
    }
    return category;
  }

  @Reactionary({})
  public override getBySlug(payload: CategoryQueryBySlug, reqCtx: RequestContext): Promise<T | null> {
    for(const p of this.allCategories.values()) {
      if(p.slug === payload.slug) {
        return Promise.resolve(p as T);
      }
    }
    return Promise.resolve(null);
  }

  @Reactionary({})
  public override getBreadcrumbPathToCategory(payload: CategoryQueryForBreadcrumb, reqCtx: RequestContext): Promise<T[]> {
    const path = new Array<T>();
    let category = this.allCategories.get(payload.id.key);
    path.push(category as T);
    while(category?.parentCategory) {
      category = this.allCategories.get(category.parentCategory.key);
      if(category) {
        path.unshift(category as T);
      }
    }
    return Promise.resolve(path);
  }

  public override async findChildCategories(payload: CategoryQueryForChildCategories, reqCtx: RequestContext): Promise<ReturnType<typeof this.parsePaginatedResult>> {
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
      items: page ? page as T[] : [],
      totalCount: children ? children.length : 0,
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalPages: children ? Math.ceil(children.length / payload.paginationOptions.pageSize) : 1,
    };

    return Promise.resolve(res);
  }
  public override findTopCategories(payload: CategoryQueryForTopCategories, reqCtx: RequestContext): Promise<ReturnType<typeof this.parsePaginatedResult>> {
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
      items: page ? page as T[] : [],
      totalCount: children ? children.length : 0,
      pageNumber: payload.paginationOptions.pageNumber,
      pageSize: payload.paginationOptions.pageSize,
      totalPages: children ? Math.ceil(children.length / payload.paginationOptions.pageSize) : 1,
    };

    return Promise.resolve(res);
  }

}
