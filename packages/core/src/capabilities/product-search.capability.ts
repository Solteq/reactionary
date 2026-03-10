import type { Category, FacetValueIdentifier, Result } from '../index.js';
import type { ProductSearchResult } from '../schemas/models/product-search.model.js';
import type {
  ProductSearchQueryByTerm,
  ProductSearchQueryCreateNavigationFilter,
} from '../schemas/queries/product-search.query.js';
import { BaseCapability } from './base.capability.js';

export abstract class ProductSearchCapability<
  TProductSearchResult extends ProductSearchResult = ProductSearchResult,
> extends BaseCapability {
  protected override getResourceName(): string {
    return 'product-search';
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

  /**
   * Parses a facet value from the search response.
   * @param facetValueIdentifier The identifier for the facet value.
   * @param label The label for the facet value.
   * @param count The count for the facet value.
   */
}
