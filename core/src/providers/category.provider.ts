

import { PaginationOptions } from "../schemas/models/base.model";
import type { Category } from "../schemas/models/category.model";
import { CategoryIdentifier } from "../schemas/models/identifiers.model";
import type { CategoryQueryById, CategoryQueryBySlug, CategoryQueryForBreadcrumb, CategoryQueryForChildCategories, CategoryQueryForTopCategories } from "../schemas/queries/category.query";
import type { RequestContext} from "../schemas/session.schema";
import { Session } from "../schemas/session.schema";
import { BaseProvider } from "./base.provider";



/**
 * CategoryProvider
 *
 * This provider allows fetching of single or sets of categories.
 *
 * We only allow fetching one hierachy level at a time, for now. This is to avoid development patterns of "fetch 5000 categories in one go.."
 *
 */
export abstract class CategoryProvider<
  T extends Category = Category
> extends BaseProvider<T> {
  /**
   * Get a single category by its ID. Cannot return null, because HOW did you come across a categories ID that does not exist?
   *
   * DISCUSSION: What do you persist in, say, a CMS or Recommendation engine? The seo slug or the ID?
   * We have previous discussed, that the ID is not necessarily the DATABASE id, but rather an externally unique identifier for the category.
   *
   * So, if you persist that externally, you could actually end up with an ID that does not exist in the current system.
   *
   * For now, the result will be en empty category, but we should probably throw an error instead.
   *
   * Use case: You have received a list of category ids from a recommendation engine, and you need to show a tile of this.
   * Future optimization: getByIds(ids: CategoryIdentifier[], reqCtx: RequestContext): Promise<T[]>
   * @param id
   * @param session
   */
  public abstract getById(payload: CategoryQueryById, reqCtx: RequestContext): Promise<T>;

  /**
   * Gets a single category by its seo slug
   *
   * Usecase: You are rendering a category page, and you have the slug from the URL.
   * @param slug the slug
   * @param session
   */
  public abstract getBySlug(payload: CategoryQueryBySlug, reqCtx: RequestContext): Promise<T | null>;


  /**
   * Gets the breadcrumb path to the category, i.e. all parents up to the root.
   * The returned order is from root to leaf.
   *
   * Usecase: You are rendering a category or product page, and you need to show the breadcrumb path.
   * @param id
   * @param session
   */
  public abstract getBreadcrumbPathToCategory(payload: CategoryQueryForBreadcrumb, reqCtx: RequestContext): Promise<T[]>;

  // hmm, this is not really good enough.... We need a type we can pass in that will allow us to specify the precise return type, but otoh we also need
  // to be able to verify and assert the output type. FIXME

  /**
   * Finds all child categories of a given category.
   *
   * Usecase: You are rendering a top menu, or mega menu, and you need the show the child categories of a given category.
   *
   * NOTE: it is recommended to create a navigational service, that allows combining CMS and Static pages into this, rather than fetching categories directly.
   *
   * @param id The ID of the parent category.
   * @param session The session information.
   */
  public abstract findChildCategories(payload: CategoryQueryForChildCategories, reqCtx: RequestContext): Promise< ReturnType<typeof this.parsePaginatedResult>>;

  /**
   * Returns all top categories, i.e. categories without a parent.
   *
   * Usecase: You are rendering a top menu, or mega menu, and you need the show the top level categories.
   * @param paginationOptions
   * @param session
   */
  public abstract findTopCategories( payload: CategoryQueryForTopCategories, reqCtx: RequestContext): Promise<ReturnType<typeof this.parsePaginatedResult>>;


  protected override getResourceName(): string {
    return 'category';
  }

}

