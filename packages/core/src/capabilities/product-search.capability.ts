import type { Category, FacetValueIdentifier, Result } from '../index.js';
import type { ProductSearchResult } from '../schemas/models/product-search.model.js';
import type {
  ProductSearchQueryByTerm,
  ProductSearchQueryCreateNavigationFilter,
} from '../schemas/queries/product-search.query.js';
import { AffinityRanking, type SearchPersonalizationOptions } from '../utils/search-ranking.js';
import { BaseCapability } from './base.capability.js';

export abstract class ProductSearchCapability<
  TProductSearchResult extends ProductSearchResult = ProductSearchResult,
> extends BaseCapability {
  protected override getResourceName(): string {
    return 'product-search';
  }

  /**
   * The ranking a provider uses when its options say `mode: 'affinity'`: Reactionary reorders the page of the engine by the interests of
   * the visitor. Providers call it once, when they first need it (not from their constructor, so that the fields of a subclass are set), and
   * keep the result. Override it in a subclass to return a subclass of AffinityRanking with other steps.
   */
  protected createSearchRanking(options?: SearchPersonalizationOptions): AffinityRanking {
    return new AffinityRanking(options);
  }

  public abstract queryByTerm(
    payload: ProductSearchQueryByTerm,
  ): Promise<Result<TProductSearchResult>>;

  /**
   * Since each platform has it own way of representing categories and their hierarchy, we leave it to the platform to tell us how to get from a
   * category breadcrumb path to a global category navigation filter that can be applied to product searches.
   *
   * So, the CLP pattern would be
   *
   * const c: Category = await categoryProvider.getBySlug({ slug: 'some-category' });
   * const breadcrumbPath: Category[] = await categoryProvider.getBreadcrumbPathToCategory({ id: c.identifier });
   * const categoryFilter: FacetValueIdentifier = categoryNavigationProvider.createCategoryNavigationFilterBreadcrumbs(breadcrumbPath);
   * const searchResult: ProductSearchResult = await productSearchProvider.queryByTerm({ term: 'some search', facets: [], categoryFilter: [categoryFilter], ... });
   *
   * from here, you would maybe get facets back with subcategories, but those are relative to the current category filter you have applied, so you
   * do not need any special handling for that.
   *
   * Usecase: You are rendering a category page and you want to run a product search to find everything in that category (or below).
   *
   * @param categoryPath
   */
  public abstract createCategoryNavigationFilter(
    payload: ProductSearchQueryCreateNavigationFilter,
  ): Promise<Result<FacetValueIdentifier>>;

}
